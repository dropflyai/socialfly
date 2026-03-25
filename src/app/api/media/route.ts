import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

const BUCKET_NAME = 'media-library'

// GET /api/media — list user's media assets
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // image | video | all
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from('brand_assets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (type && type !== 'all') query = query.eq('type', type)
  if (category && category !== 'all') query = query.eq('category', category)
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ assets: data || [] })
}

// POST /api/media — upload a new media asset
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string) || ''
  const category = (formData.get('category') as string) || 'general'
  const tags = (formData.get('tags') as string) || ''

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Only image and video files are supported' }, { status: 400 })
  }

  // 100MB limit for videos, 20MB for images
  const maxSize = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json({
      error: `File too large. Max ${isVideo ? '100MB' : '20MB'}.`,
    }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Ensure bucket exists
  const { data: buckets } = await serviceClient.storage.listBuckets()
  if (!buckets?.find((b: { name: string }) => b.name === BUCKET_NAME)) {
    await serviceClient.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: ['image/*', 'video/*'],
    })
  }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET_NAME)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  // Save asset record
  const assetType = isVideo ? 'video' : 'image'
  const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

  const { data: asset, error: dbError } = await serviceClient
    .from('brand_assets')
    .insert({
      user_id: user.id,
      type: assetType,
      category,
      name: name || file.name,
      url: urlData.publicUrl,
      mime_type: file.type,
      file_size: file.size,
      tags: tagArray,
      usage_count: 0,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: `Failed to save asset: ${dbError.message}` }, { status: 500 })
  }

  return NextResponse.json({ asset })
}

// DELETE /api/media?id=xxx — delete a media asset
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('id')
  if (!assetId) return NextResponse.json({ error: 'Missing asset id' }, { status: 400 })

  const serviceClient = createServiceClient()

  // Get the asset to find the storage path
  const { data: asset } = await serviceClient
    .from('brand_assets')
    .select('url')
    .eq('id', assetId)
    .eq('user_id', user.id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  // Delete from storage if it's a Supabase URL
  if (asset.url.includes(BUCKET_NAME)) {
    const storagePath = asset.url.split(`${BUCKET_NAME}/`).pop()
    if (storagePath) {
      await serviceClient.storage.from(BUCKET_NAME).remove([storagePath])
    }
  }

  // Delete DB record
  const { error } = await serviceClient
    .from('brand_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
