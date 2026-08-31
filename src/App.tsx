import { Routes, Route } from 'react-router-dom'
import Header from './components/Layout/Header'
import Footer from './components/Layout/Footer'
import Home from './pages/Home'
import SepararPdf from './pages/SepararPdf'
import RotarPdf from './pages/RotarPdf'
import EliminarPaginas from './pages/EliminarPaginas'
import UnirPdf from './pages/UnirPdf'
import WordAPdf from './pages/WordAPdf'

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/separar-pdf" element={<SepararPdf />} />
          <Route path="/rotar-pdf" element={<RotarPdf />} />
          <Route path="/eliminar-paginas" element={<EliminarPaginas />} />
          <Route path="/unir-pdf" element={<UnirPdf />} />
          <Route path="/word-a-pdf" element={<WordAPdf />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
