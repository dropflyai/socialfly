import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - SocialFly',
  description: 'SocialFly privacy policy - how we collect, use, and protect your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">SocialFly</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: March 25, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>
              SocialFly, operated by DropFly Inc. (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when
              you use our social media management platform at socialfly.io (&quot;the Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information (name, email address, password)</li>
              <li>Profile information and brand preferences</li>
              <li>Content you create, upload, or publish through the Service</li>
              <li>Social media account credentials and authorization tokens</li>
              <li>Payment information (processed securely by Stripe)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Usage data (features used, actions taken within the Service)</li>
              <li>Device information (browser type, operating system)</li>
              <li>Log data (IP address, access times, pages viewed)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Information from Third-Party Platforms</h3>
            <p>
              When you connect social media accounts (Instagram, Facebook, TikTok, LinkedIn), we receive
              authorization tokens and basic profile information necessary to publish content on your behalf.
              We access only the data and permissions you explicitly authorize.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain the Service</li>
              <li>To publish and schedule content to your connected social media accounts</li>
              <li>To generate AI-powered content suggestions and images</li>
              <li>To provide analytics and insights about your social media performance</li>
              <li>To process payments and manage subscriptions</li>
              <li>To communicate with you about the Service</li>
              <li>To improve and develop new features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only in these circumstances:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Social media platforms:</strong> Content you choose to publish is sent to the platforms you authorize (Instagram, Facebook, TikTok, LinkedIn)</li>
              <li><strong>AI service providers:</strong> Content prompts are processed by AI services (Anthropic, FAL.ai) to generate text and images. These providers process data per their own privacy policies.</li>
              <li><strong>Infrastructure providers:</strong> We use Supabase (database), Vercel (hosting), and Stripe (payments) to operate the Service</li>
              <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
            <p>
              Your data is stored securely using Supabase with row-level security policies. Social media
              tokens are encrypted at rest. We implement industry-standard security measures to protect
              your information from unauthorized access, alteration, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you delete your account,
              we delete your personal data within 30 days, except where retention is required by law.
              Published content on third-party platforms is subject to those platforms&apos; retention policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect social media accounts at any time</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use
              third-party tracking cookies or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for users under the age of 13. We do not knowingly collect
              personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or to exercise your data rights, contact us at{' '}
              <a href="mailto:privacy@socialfly.io" className="text-primary hover:underline">privacy@socialfly.io</a>.
            </p>
            <p className="mt-3">
              DropFly Inc.<br />
              Email: <a href="mailto:privacy@socialfly.io" className="text-primary hover:underline">privacy@socialfly.io</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
