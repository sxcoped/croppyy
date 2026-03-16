/**
 * Sidebar primitives — adapted from Aceternity UI
 * Changes from original:
 *   • next/link  → NavLink from react-router-dom
 *   • framer-motion → motion/react  (motion v12 package already installed)
 *   • TypeScript types removed
 *   • Tailwind colour tokens mapped to Croppy's dark-green design system
 */

import { createContext, useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Context ───────────────────────────────────────────────────────────────────
const SidebarContext = createContext(undefined);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}

export function SidebarProvider({ children, open: openProp, setOpen: setOpenProp, animate = true }) {
  const [openState, setOpenState] = useState(false);
  const open    = openProp    !== undefined ? openProp    : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children, open, setOpen, animate }) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
}

export function SidebarBody(props) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar  {...props} />
    </>
  );
}

// ── Desktop sidebar — animates width on hover ─────────────────────────────────
export function DesktopSidebar({ className, children, ...props }) {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        'hidden md:flex md:flex-col h-screen flex-shrink-0 px-3 py-4',
        'bg-[#ffffff] border-r border-[rgba(67,160,71,0.12)]',
        className
      )}
      animate={{ width: animate ? (open ? '260px' : '64px') : '260px' }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ── Mobile sidebar — slides in from left as full-screen drawer ────────────────
export function MobileSidebar({ className, children, ...props }) {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {/* Topbar with hamburger */}
      <div className="flex md:hidden h-12 px-4 items-center justify-between bg-[#ffffff] border-b border-[rgba(67,160,71,0.12)] w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white text-xs font-bold">
            C
          </div>
          <span className="text-[#1b5e20] font-bold text-sm tracking-tight">Croppy</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-[#6b8a72] hover:text-[#1b5e20] transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className={cn(
              'fixed inset-0 z-[200] flex flex-col bg-[#ffffff] p-6',
              className
            )}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 text-[#6b8a72] hover:text-[#1b5e20] transition-colors"
            >
              <X size={20} />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sidebar link — wraps react-router NavLink with animated label ─────────────
export function SidebarLink({ link, className, active, badge, ...props }) {
  const { open, animate } = useSidebar();
  return (
    <NavLink
      to={link.href}
      end={link.href === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 py-2.5 px-3 rounded-lg',
          'text-[#6b8a72] hover:text-[#1b5e20] hover:bg-[#ffffff]',
          'transition-all duration-150 group/link relative',
          isActive && 'bg-[rgba(67,160,71,0.1)] !text-[#66bb6a] font-semibold',
          className
        )
      }
      {...props}
    >
      {({ isActive }) => (
        <>
          {/* Active left-bar indicator */}
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[#66bb6a]" />
          )}

          {/* Icon */}
          <span className="flex-shrink-0">{link.icon}</span>

          {/* Label */}
          <motion.span
            animate={{
              display:  animate ? (open ? 'inline-block' : 'none') : 'inline-block',
              opacity:  animate ? (open ? 1 : 0)              : 1,
            }}
            transition={{ duration: 0.15 }}
            className="text-sm whitespace-pre group-hover/link:translate-x-0.5 transition-transform duration-150 !p-0 !m-0"
          >
            {link.label}
          </motion.span>

          {/* Badge */}
          {badge && (
            <motion.span
              animate={{
                display: animate ? (open ? 'flex' : 'none') : 'flex',
                opacity: animate ? (open ? 1 : 0)           : 1,
              }}
              className="ml-auto h-4 min-w-4 px-1 rounded-full bg-[#ef5350] text-white text-[10px] font-bold flex items-center justify-center"
            >
              !
            </motion.span>
          )}
        </>
      )}
    </NavLink>
  );
}
