/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist (via react-pdf) optionally requires the native `canvas`
    // package on the server. We only render PDFs in the browser, so stub it
    // out to keep the build clean.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
}

export default nextConfig
