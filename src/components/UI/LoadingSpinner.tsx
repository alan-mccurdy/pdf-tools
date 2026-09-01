/**
 * Loading Spinner Component
 * Simple spinner for loading states
 */

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}