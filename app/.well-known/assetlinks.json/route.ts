import { NextResponse } from 'next/server'

// Digital Asset Links for the Play Store TWA. ASSETLINKS_FINGERPRINTS holds the
// SHA-256 cert fingerprints from Play Console -> App Integrity (comma-separated;
// include both the Play App Signing cert and the upload cert for local testing).
export async function GET() {
  const fingerprints = (process.env.ASSETLINKS_FINGERPRINTS ?? '')
    .split(',')
    .map(f => f.trim())
    .filter(Boolean)

  const packageName = process.env.TWA_PACKAGE_NAME ?? 'app.forge.twa'

  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, max-age=300' },
    })
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    }
  )
}
