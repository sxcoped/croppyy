"use client"
import * as React from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

const Ctx = React.createContext(undefined)

export function ContainerScroll({ children, style, ...props }) {
  const ref = React.useRef(null)
  const { scrollYProgress } = useScroll({ target: ref })
  return (
    <Ctx.Provider value={{ scrollYProgress }}>
      <div ref={ref} style={{ position: 'relative', width: '100%', ...style }} {...props}>
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function BentoGrid({ children, style, ...props }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
      gridTemplateRows: '1fr 0.5fr 0.5fr 1fr', gap: 12,
      position: 'sticky', left: 0, top: 0, height: '100vh',
      width: '100%', padding: 12, zIndex: 0, ...style,
    }} {...props}>
      {children}
    </div>
  )
}

export function BentoCell({ children, style, gridArea, ...props }) {
  const { scrollYProgress } = React.useContext(Ctx)
  const translate = useTransform(scrollYProgress, [0.05, 0.85], ['-30%', '0%'])
  const scale = useTransform(scrollYProgress, [0, 0.85], [0.5, 1])
  return (
    <motion.div
      style={{ overflow: 'hidden', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', translate, scale, ...gridArea, ...style }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function ContainerScale({ children, style, ...props }) {
  const { scrollYProgress } = React.useContext(Ctx)
  const opacity = useTransform(scrollYProgress, [0, 0.45], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.45], [1, 0])
  const position = useTransform(scrollYProgress, (p) => p >= 0.55 ? 'absolute' : 'fixed')
  return (
    <motion.div
      style={{
        left: '50%', top: '50%', translate: '-50% -50%',
        width: 'fit-content', scale, position, opacity,
        zIndex: 10, ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
