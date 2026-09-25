'use client'
import { useState, useEffect } from 'react'
import {
  Users,
  BookOpen,
  ClipboardList,
  Zap,
  CalendarCheck,
  FileText,
} from 'lucide-react'
import FormulaBackdrop, { type Formula } from './FormulaBackdrop'

const backdropFormulas: Formula[] = [
  { text: 'v = u + at', top: '8%', left: '3%', rotate: -14 },
  { text: 'log₁₀(x)', top: '20%', right: '4%', rotate: 11, tone: 'gold' },
  { text: '2H₂ + O₂ → 2H₂O', top: '52%', left: '2%', rotate: 8 },
  { text: 'dy/dx', top: '70%', right: '6%', rotate: -9 },
  { text: 'sin²θ + cos²θ = 1', top: '88%', left: '8%', rotate: 12, tone: 'gold' },
]

const features = [
  {
    title: 'Experienced Tutors',
    desc: 'Learn from highly skilled tutors with years of teaching experience.',
    icon: Users,
  },
  {
    title: 'Simplified Lessons',
    desc: 'Every topic is broken down into simple, digestible formats for all learners.',
    icon: BookOpen,
  },
  {
    title: 'Weekly Assessments',
    desc: 'Standard assessment tests designed to track your progress and reinforce understanding.',
    icon: ClipboardList,
  },
  {
    title: 'Challenge Mode',
    desc: 'Test your speed and accuracy with fast-paced quizzes via Rapid Quiz.',
    icon: Zap,
  },
  {
    title: 'Daily Accountability',
    desc: 'We monitor your daily studies for effective learning via our welfare arm.',
    icon: CalendarCheck,
  },
  {
    title: 'Exam-Focused Material',
    desc: 'Get high-quality materials in both print and digital formats.',
    icon: FileText,
  },
]

export default function WhyChooseDSA() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <section
      id='why-dsa'
      className='relative w-full py-24 bg-white overflow-hidden'
    >
      <FormulaBackdrop formulas={backdropFormulas} />

      <div className='relative z-10 max-w-7xl mx-auto px-10 md:px-20'>
        {/* SECTION TITLE */}
        <div
          data-aos='fade-up'
          data-aos-duration='600'
          className='text-center max-w-2xl mx-auto'
        >
          <span className='text-[#002EFF] font-bold tracking-widest text-sm uppercase'>
            Advantages
          </span>
          <h2 className='text-3xl md:text-4xl font-extrabold text-black mt-2 leading-tight uppercase'>
            Why Choose <span className='text-[#002EFF]'>DSA?</span>
          </h2>
          <div className='w-20 h-1.5 bg-[#FCB900] mx-auto mt-4 rounded-full'></div>
          <p className='mt-6 text-gray-600 text-lg leading-relaxed'>
            We provide a structured, student-focused learning experience that
            guarantees academic improvement.
          </p>
        </div>

        {/* FEATURES GRID */}
        <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-16'>
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={`feature-${index}`}
                data-aos='fade-up'
                data-aos-delay={index * 60}
                data-aos-duration='500'
                className='group p-8 rounded-2xl bg-[#f8f9ff] border border-transparent hover:border-[#002EFF]/30 hover:bg-white hover:shadow-2xl transition-all duration-300 ease-out'
              >
                <div className='w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-[#002EFF] transition-colors duration-300'>
                  <Icon
                    className='text-[#002EFF] group-hover:text-white transition-colors duration-300'
                    size={28}
                  />
                </div>
                <h3 className='text-xl font-bold text-black mt-6 group-hover:text-[#002EFF] transition-colors uppercase'>
                  {feature.title}
                </h3>
                <p className='text-gray-600 mt-3 leading-relaxed text-sm md:text-base'>
                  {feature.desc}
                </p>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
