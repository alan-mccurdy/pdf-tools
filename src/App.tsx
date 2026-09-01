import { Routes, Route } from 'react-router-dom'
import React, { lazy, Suspense } from 'react'
import Header from './components/Layout/Header'
import Footer from './components/Layout/Footer'

// Lazy load all page components for better performance
const Home = lazy(() => import('./pages/Home'))
const SepararPdf = lazy(() => import('./pages/SepararPdf'))
const RotarPdf = lazy(() => import('./pages/RotarPdf'))
const EliminarPaginas = lazy(() => import('./pages/EliminarPaginas'))
const UnirPdf = lazy(() => import('./pages/UnirPdf'))
const WordAPdf = lazy(() => import('./pages/WordAPdf'))
const EditarPdf = lazy(() => import('./pages/EditarPdf'))
const ComprimirPdf = lazy(() => import('./pages/ComprimirPdf'))
const InsertarImagenes = lazy(() => import('./pages/InsertarImagenes'))
const PdfAWord = lazy(() => import('./pages/PdfAWord'))
const OCRedor = lazy(() => import('./pages/OCRedor'))

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/separar-pdf" element={<SepararPdf />} />
            <Route path="/rotar-pdf" element={<RotarPdf />} />
            <Route path="/eliminar-paginas" element={<EliminarPaginas />} />
            <Route path="/unir-pdf" element={<UnirPdf />} />
            <Route path="/word-a-pdf" element={<WordAPdf />} />
            <Route path="/editar-pdf" element={<EditarPdf />} />
            <Route path="/comprimir-pdf" element={<ComprimirPdf />} />
            <Route path="/insertar-imagenes" element={<InsertarImagenes />} />
            <Route path="/pdf-a-word" element={<PdfAWord />} />
            <Route path="/ocr-pdf" element={<OCRedor />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <p className="text-white/70">Página no encontrada</p>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default App
