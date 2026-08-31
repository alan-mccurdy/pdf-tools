import { ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import AdSlot from '../Ads/AdSlot'

interface PDFToolLayoutProps {
  title: string
  description: string
  keyword: string
  children: ReactNode
}

export default function PDFToolLayout({ title, description, keyword, children }: PDFToolLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{title} — PDF Tools Gratis</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
      </Helmet>

      <AdSlot position="top" className="mb-6" />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{keyword}</h1>
          <p className="text-gray-400 mb-6">{description}</p>
          {children}
        </div>
        <aside className="w-full lg:w-80 shrink-0">
          <AdSlot position="sidebar" />
        </aside>
      </div>

      <AdSlot position="bottom" className="mt-8" />
    </>
  )
}
