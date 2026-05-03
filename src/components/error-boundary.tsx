"use client"

import React, { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Global Error Boundary — Catches any unhandled React rendering errors
 * and displays a friendly fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ERROR_BOUNDARY] Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sage-50 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🧘‍♂️</span>
            </div>
            <h2 className="text-2xl font-display text-ink mb-3">Bir Sorun Oluştu</h2>
            <p className="text-sage-600 mb-6 text-sm leading-relaxed">
              Beklenmedik bir hata meydana geldi. Lütfen sayfayı yeniden yükleyin. 
              Sorun devam ederse ekibimizle iletişime geçin.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-sage-600 hover:bg-sage-700 text-white px-8 py-3 rounded-full text-sm font-medium transition shadow-lg shadow-sage-600/20"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
