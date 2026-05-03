"use client"

import { useState } from "react"
import { ReviewModal } from "./review-modal"

interface ReviewButtonProps {
  bookingId: string
  teacherName: string
}

export function ReviewButton({ bookingId, teacherName }: ReviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-sage-600 hover:text-sage-900 text-sm font-medium transition btn-press px-4 py-2 bg-white rounded-full border border-sage-200 hover:border-sage-300 shadow-sm"
      >
        Review
      </button>
      
      {isOpen && (
        <ReviewModal 
          bookingId={bookingId} 
          teacherName={teacherName} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  )
}
