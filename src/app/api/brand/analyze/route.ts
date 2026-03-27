import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyzeBrand, analysisToProfileData, validateUrl } from '@/lib/brand/analyzer'
import { checkBrandLimit } from '@/lib/tier-gates'

export const maxDuration = 60 // Allow up to 60 seconds for analysis

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check brand limit for user's tier
    const brandCheck = await checkBrandLimit(user.id)
    if (!brandCheck.allowed) {
      return NextResponse.json(
        { error: brandCheck.reason, upgradeRequired: brandCheck.upgradeRequired },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { url, instagramHandle, analysisDepth = 'standard', createProfile = true } = body

    // Validate input
    if (!url && !instagramHandle) {
      return NextResponse.json(
        { error: 'Either url or instagramHandle is required' },
        { status: 400 }
      )
    }

    // Validate URL if provided
    if (url) {
      const validation = await validateUrl(url)
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid URL: ${validation.error}` },
          { status: 400 }
        )
      }
    }

    // Perform brand analysis
    const result = await analyzeBrand({
      url,
      instagramHandle,
      analysisDepth,
    })

    if (!result.success || !result.analysis) {
      return NextResponse.json(
        { error: result.error || 'Analysis failed' },
        { status: 500 }
      )
    }

    // Store brand profile if requested
    let brandProfile = null
    if (createProfile) {
      const profileData = analysisToProfileData(
        result.analysis,
        url || instagramHandle,
        url ? 'website' : 'instagram'
      )

      const { data, error: insertError } = await supabase
        .from('brand_profiles')
        .insert({
          user_id: user.id,
          ...profileData,
          analysis_status: 'complete',
          analysis_completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to store brand profile:', insertError)
        // Don't fail the request, just log it
      } else {
        brandProfile = data
      }

      // Store analysis history
      if (brandProfile) {
        await supabase.from('brand_analysis_history').insert({
          brand_id: brandProfile.id,
          user_id: user.id,
          source_url: url || instagramHandle,
          analysis_type: 'full',
          voice_analysis: result.analysis.voice,
          visual_analysis: result.analysis.visualStyle,
          audience_analysis: result.analysis.audience,
          extracted_content: result.scrapedContent?.[0] || null,
          pages_analyzed: result.metadata.pagesAnalyzed,
          duration_ms: result.metadata.analysisTime,
          status: 'complete',
        })
      }
    }

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      brandProfile,
      metadata: result.metadata,
    })
  } catch (error) {
    console.error('Brand analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check analysis status or fetch existing analysis
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId')

    if (brandId) {
      // Fetch specific brand
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Brand not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ brandProfile: data })
    } else {
      // Fetch all brands for user
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch brands' },
          { status: 500 }
        )
      }

      return NextResponse.json({ brandProfiles: data })
    }
  } catch (error) {
    console.error('Brand fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
