"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { HighlightedText } from "./highlighted-text"

/**
 * "The Transformation" — the before/after pair of clips on the interior site.
 *
 * Every width pins the same stage: the visitor scrolls, nothing moves for a beat
 * (HOLD_UNTIL), then the "before" clip crossfades into the "after" clip. The change
 * is a latched, time-eased CSS transition rather than a scroll-scrubbed one — scroll
 * only arms it, and CSS performs it, which keeps the fade smooth on momentum
 * scrolling and gives it a consistent 1.1s cadence at every breakpoint.
 *
 * Layout and motion live in `motion-safe:*` / `motion-safe:lg:*` classes, so the
 * server-rendered HTML is already correct for the visitor's viewport and motion
 * preference: no flash, no layout shift, no hydration mismatch. Visitors who ask for
 * reduced motion get two stacked ambient cards instead, driven by IntersectionObserver.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** Scroll landmarks, as a fraction of the pinned scroll window. */
const HOLD_UNTIL = 0.3 // the delay — nothing changes before this point
const DISARM_AT = 0.2 // hysteresis: "after" is only left below this
const SETTLE_UNTIL = 0.72 // outro begins; the rail completes before the unpin
const AFTER_PRELOAD_AT = 0.15 // start fetching the 30MB clip during the hold
const MANUAL_RELEASE = 0.08 // scrolling this far against a tap hands control back

/** Must match the `duration-[1100ms]` class on the cards. */
const CROSSFADE_MS = 1100
/** Cushion before the outgoing clip is paused, so the fade never looks cut. */
const CROSSFADE_TAIL = 120

/** Weeks 0 / 3 / 8 / 14 mapped onto the pin. Week 8 sits exactly on the crossfade
 *  trigger, so the "after" clip reads as starting at week 8 and running to handover. */
const WEEK_TICKS = [
  { week: "0", at: 0 },
  { week: "3", at: 0.12 },
  { week: "8", at: HOLD_UNTIL },
  { week: "14", at: SETTLE_UNTIL },
]

/** Card positions, in the same order as `CLIPS` — the two states of the stage. */
const PHASES = ["before", "after"] as const

type Phase = (typeof PHASES)[number]

type Clip = {
  id: string
  src: string
  label: string
  caption: string
  /** Optional still, shown until the clip has enough data to paint. */
  poster?: string
}

const CLIPS: Clip[] = [
  {
    id: "before",
    src: "/images/before.mp4",
    label: "Before",
    caption: "First fix — week 3",
  },
  {
    id: "after",
    src: "/images/after.mp4",
    label: "After",
    caption: "Week 8 to handover",
  },
]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const activeTickFor = (progress: number) =>
  WEEK_TICKS.reduce((active, tick, index) => (progress >= tick.at ? index : active), 0)

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)

    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

/** Card shell. In the pinned layout the two cards are layers of one stage; under
 *  reduced motion they stay in normal flow, one beneath the other. */
const CARD_CLASSES = "relative aspect-video overflow-hidden rounded-2xl bg-secondary"
const CARD_PINNED =
  "motion-safe:absolute motion-safe:inset-0 motion-safe:aspect-auto motion-safe:rounded-none lg:motion-safe:rounded-2xl"
/** The crossfade. Only the values are gated by `motion-safe`, so reduced motion is inert. */
const CARD_MOTION = "transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
const CARD_ACTIVE = "motion-safe:pointer-events-auto motion-safe:opacity-100"
const CARD_IDLE = "motion-safe:pointer-events-none motion-safe:opacity-0"
/** The incoming clip lifts and settles; the outgoing one gently eases back. */
const MEDIA_ACTIVE = "motion-safe:translate-y-0 motion-safe:scale-100"
const MEDIA_IDLE = "motion-safe:translate-y-3 motion-safe:scale-[1.02]"

type ClipCardProps = {
  clip: Clip
  index: number
  /** False when the other clip holds the stage — keeps the control out of the tab order. */
  isActive: boolean
  isPlaying: boolean
  /** True on the first paint after a reload, which must place the state rather than animate it. */
  noAnimate: boolean
  shouldLoad: boolean
  onToggle: (index: number) => void
  registerVideo: (index: number, el: HTMLVideoElement | null) => void
  registerFrame: (index: number, el: HTMLDivElement | null) => void
}

function ClipCard({
  clip,
  index,
  isActive,
  isPlaying,
  noAnimate,
  shouldLoad,
  onToggle,
  registerVideo,
  registerFrame,
}: ClipCardProps) {
  const [isReady, setIsReady] = useState(false)
  const elRef = useRef<HTMLVideoElement | null>(null)
  const isPrimary = index === 0
  // Inline, because a utility class could not reliably win against the transition
  // utilities when both are wrapped in the same media query.
  const freeze = noAnimate ? { transitionProperty: "none" } : undefined

  useEffect(() => {
    // The src is already in the server-rendered HTML, so the browser starts
    // loading (and may even fire loadeddata) before hydration attaches listeners.
    // Without this check the clip could play forever behind opacity-0.
    if (elRef.current && elRef.current.readyState >= 2) setIsReady(true)
  }, [])

  return (
    <div
      ref={(el) => {
        registerFrame(index, el)
      }}
      aria-hidden={!isActive}
      className={cn(CARD_CLASSES, CARD_PINNED, CARD_MOTION, isActive ? CARD_ACTIVE : CARD_IDLE)}
      style={freeze}
    >
      {/* Inner layer carries the film move, so the chip below fades without drifting. */}
      <div
        className={cn("absolute inset-0", CARD_MOTION, isActive ? MEDIA_ACTIVE : MEDIA_IDLE)}
        style={freeze}
      >
        {clip.poster ? (
          <img
            src={clip.poster}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {/* Muted, looping and silent by design; the chip carries the meaning. */}
        <video
          ref={(el) => {
            registerVideo(index, el)
            elRef.current = el
          }}
          src={isPrimary || shouldLoad ? clip.src : undefined}
          poster={clip.poster}
          muted
          loop
          playsInline
          preload={isPrimary ? "metadata" : shouldLoad ? "auto" : "none"}
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={() => setIsReady(true)}
          onPlay={() => setIsReady(true)}
          onError={() => setIsReady(false)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out",
            isReady ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {/* Label chip: the caption of the stage on every breakpoint. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end p-6 lg:p-4">
        <span className="inline-flex flex-col bg-background/80 px-3 py-2 backdrop-blur-sm">
          <span className="text-xs uppercase tracking-widest text-foreground">{clip.label}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">{clip.caption}</span>
        </span>
      </div>

      {/* Autoplaying motion must be pausable (WCAG 2.2.2); this is also the
          fallback control when a browser blocks autoplay. */}
      <button
        type="button"
        onClick={() => onToggle(index)}
        disabled={!isActive}
        aria-label={`${isPlaying ? "Pause" : "Play"} the ${clip.label.toLowerCase()} video`}
        className={cn(
          "absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-background/80 text-foreground backdrop-blur-sm transition-colors duration-300 hover:bg-foreground hover:text-background",
          !isActive && "invisible",
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <Play className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>
    </div>
  )
}

export function BeforeAfter() {
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null])
  const frameRefs = useRef<(HTMLDivElement | null)[]>([null, null])
  const progressRef = useRef(0)
  const scrollPhaseRef = useRef<Phase>("before")
  const manualRef = useRef<{ phase: Phase; at: number } | null>(null)
  const activeTickRef = useRef(0)
  const preloadRef = useRef(false)
  /** Set when the visitor pauses by hand — playback never resumes on its own after that (WCAG 2.2.2). */
  const userPausedRef = useRef<boolean[]>([false, false])
  const visibleRef = useRef<boolean[]>([false, false])
  const rafRef = useRef<number | null>(null)

  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  /** True unless the visitor asked for reduced motion — mirrors the `motion-safe:*` classes. */
  const pinnedMode = !prefersReducedMotion

  const [scrollPhase, setScrollPhase] = useState<Phase>("before")
  const [manualPhase, setManualPhase] = useState<Phase | null>(null)
  const [activeTick, setActiveTick] = useState(0)
  const [playingClips, setPlayingClips] = useState<boolean[]>([false, false])
  const [sectionVisible, setSectionVisible] = useState(false)
  const [shouldLoadAfter, setShouldLoadAfter] = useState(false)
  const [noAnimate, setNoAnimate] = useState(true)

  const phase: Phase = manualPhase ?? scrollPhase

  const markPlaying = useCallback((index: number, isPlaying: boolean) => {
    setPlayingClips((previous) =>
      previous[index] === isPlaying ? previous : previous.map((value, i) => (i === index ? isPlaying : value)),
    )
  }, [])

  const startClip = useCallback(
    (index: number) => {
      const video = videoRefs.current[index]
      if (!video || userPausedRef.current[index]) return
      if (!video.paused) {
        markPlaying(index, true)
        return
      }

      try {
        const attempt = video.play()
        if (attempt && typeof attempt.then === "function") {
          // A rejected promise means the browser blocked autoplay (iOS Low Power
          // Mode, data saver) — the poster stays and the button offers playback.
          attempt.then(() => markPlaying(index, true)).catch(() => markPlaying(index, false))
        } else {
          markPlaying(index, true)
        }
      } catch {
        markPlaying(index, false)
      }
    },
    [markPlaying],
  )

  const stopClip = useCallback(
    (index: number) => {
      const video = videoRefs.current[index]
      if (!video) return
      if (video.paused) {
        markPlaying(index, false)
        return
      }
      video.pause()
      markPlaying(index, false)
    },
    [markPlaying],
  )

  /** Reduced motion only: play whichever stacked card is on screen. */
  const syncStackedPlayback = useCallback(() => {
    visibleRef.current.forEach((isVisible, index) => {
      if (isVisible) startClip(index)
      else stopClip(index)
    })
  }, [startClip, stopClip])

  /** The touch toggle: latches a phase and hands control back once the visitor scrolls against it. */
  const selectPhase = useCallback((next: Phase) => {
    if (next === (manualRef.current?.phase ?? scrollPhaseRef.current)) return
    manualRef.current = { phase: next, at: progressRef.current }
    setManualPhase(next)
  }, [])

  /** Writes the rail progress and the phase latch; React re-renders only on a change. */
  const updateProgress = useCallback(() => {
    const section = sectionRef.current
    if (!section) return

    // Measured against the sticky wrapper, not window.innerHeight: the mobile URL
    // bar changing height must not move the pin or shift the trigger.
    const pinHeight = stickyRef.current?.offsetHeight ?? window.innerHeight
    const scrollable = section.offsetHeight - pinHeight
    const progress = scrollable > 0 ? clamp01(-section.getBoundingClientRect().top / scrollable) : 0
    progressRef.current = progress

    const stage = stageRef.current
    if (stage) stage.style.setProperty("--p", String(progress))

    // Phase: latched with hysteresis, unless a tap is holding it.
    const manual = manualRef.current
    if (manual) {
      const released =
        manual.phase === "after" ? progress <= manual.at - MANUAL_RELEASE : progress >= manual.at + MANUAL_RELEASE
      if (released) {
        manualRef.current = null
        setManualPhase(null)
      }
    } else if (progress >= HOLD_UNTIL) {
      if (scrollPhaseRef.current !== "after") {
        scrollPhaseRef.current = "after"
        setScrollPhase("after")
      }
    } else if (progress <= DISARM_AT) {
      if (scrollPhaseRef.current !== "before") {
        scrollPhaseRef.current = "before"
        setScrollPhase("before")
      }
    }

    // The 30MB clip starts fetching during the hold, so the incoming frame is
    // already painted by the time the crossfade reaches it.
    if (progress >= AFTER_PRELOAD_AT && !preloadRef.current) {
      preloadRef.current = true
      setShouldLoadAfter(true)
    }

    const tick = activeTickFor(progress)
    if (tick !== activeTickRef.current) {
      activeTickRef.current = tick
      setActiveTick(tick)
    }
  }, [])

  const registerVideo = useCallback((index: number, el: HTMLVideoElement | null) => {
    videoRefs.current[index] = el
  }, [])

  const registerFrame = useCallback((index: number, el: HTMLDivElement | null) => {
    frameRefs.current[index] = el
  }, [])

  const toggleClip = useCallback(
    (index: number) => {
      const video = videoRefs.current[index]
      if (!video) return

      if (!video.paused) {
        userPausedRef.current[index] = true
        stopClip(index)
      } else {
        userPausedRef.current[index] = false
        startClip(index)
      }
    },
    [startClip, stopClip],
  )

  // The pin: scroll position drives the rail and arms the phase.
  useEffect(() => {
    if (!pinnedMode) {
      progressRef.current = 0
      const stage = stageRef.current
      if (stage) stage.style.removeProperty("--p")
      return
    }

    const handleScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(updateProgress)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleScroll)
    updateProgress() // a reload part-way down the section must not wait for the first scroll

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [pinnedMode, updateProgress])

  // Gate playback on the section being on screen, so nothing streams behind the fold.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(([entry]) => setSectionVisible(entry.isIntersecting), {
      threshold: 0.05,
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Reduced motion only: the cards are in flow, so play whichever one is on screen.
  useEffect(() => {
    if (pinnedMode) {
      visibleRef.current = [false, false]
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = frameRefs.current.indexOf(entry.target as HTMLDivElement)
          if (index !== -1) visibleRef.current[index] = entry.isIntersecting
        })
        syncStackedPlayback()
      },
      { threshold: 0.5 },
    )

    frameRefs.current.forEach((frame) => {
      if (frame) observer.observe(frame)
    })

    return () => observer.disconnect()
  }, [pinnedMode, syncStackedPlayback])

  // Scroll arms the change; the clips follow the phase over the fade's own duration.
  useEffect(() => {
    if (!pinnedMode) {
      syncStackedPlayback()
      return
    }

    if (!sectionVisible) {
      stopClip(0)
      stopClip(1)
      return
    }

    const incoming = phase === "after" ? 1 : 0
    startClip(incoming)

    const timer = window.setTimeout(() => stopClip(1 - incoming), CROSSFADE_MS + CROSSFADE_TAIL)
    return () => window.clearTimeout(timer)
  }, [phase, pinnedMode, sectionVisible, startClip, stopClip, syncStackedPlayback])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopClip(0)
        stopClip(1)
        return
      }

      if (!pinnedMode) {
        syncStackedPlayback()
        return
      }

      if (sectionVisible) {
        const current = manualRef.current?.phase ?? scrollPhaseRef.current
        startClip(current === "after" ? 1 : 0)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [pinnedMode, sectionVisible, startClip, stopClip, syncStackedPlayback])

  // Drop the transition-freeze one frame after mount, so a reload mid-section is
  // placed in the right state instead of animating into it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNoAnimate(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  // `md:motion-safe:*` duplicates are deliberate: Tailwind orders a single-variant
  // `motion-safe:*` before the `md:`/`lg:` buckets, so a pinned value has to be repeated
  // at the breakpoint it needs to beat (padding here must be exactly 0 or the pin window
  // measured below no longer matches the real sticky travel).
  return (
    <section
      id="transformation"
      ref={sectionRef}
      aria-labelledby="transformation-heading"
      className="relative bg-background py-32 md:py-29 motion-safe:py-0 md:motion-safe:py-0 motion-safe:min-h-[200svh] lg:motion-safe:min-h-[280vh]"
    >
      <div
        ref={stickyRef}
        className="container mx-auto px-6 md:px-12 motion-safe:sticky motion-safe:top-0 motion-safe:flex motion-safe:h-svh motion-safe:flex-col motion-safe:justify-center motion-safe:pt-24 motion-safe:pb-6"
      >
        <div className="max-w-2xl">
          <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-6">The Transformation</p>

          <h2
            id="transformation-heading"
            className="text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight text-balance"
          >
            From bare shell to <HighlightedText>finished interior</HighlightedText>
          </h2>

          <p className="text-muted-foreground text-base md:text-lg leading-relaxed mt-6 max-w-xl">
            Fourteen weeks on site, shown in two clips. Watch the same rooms go from first fix and bare
            blockwork to the finished interior — joinery hung, floors laid, lighting set, every surface dressed.
          </p>
        </div>

        <div
          ref={stageRef}
          className="relative grid grid-cols-1 gap-6 md:gap-8 mt-12 md:mt-16 motion-safe:mt-8 md:motion-safe:mt-8 motion-safe:-mx-6 motion-safe:aspect-video md:motion-safe:-mx-12 lg:motion-safe:mx-auto lg:motion-safe:aspect-auto lg:motion-safe:h-[44vh] lg:motion-safe:w-[min(100%,78.2vh)]"
        >
          {CLIPS.map((clip, index) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              index={index}
              isActive={!pinnedMode || phase === PHASES[index]}
              isPlaying={playingClips[index]}
              noAnimate={noAnimate}
              shouldLoad={index === 0 || shouldLoadAfter}
              onToggle={toggleClip}
              registerVideo={registerVideo}
              registerFrame={registerFrame}
            />
          ))}
        </div>

        {/* Build rail and the 14-week story, filled by the scroll. */}
        <div className="mt-8 hidden motion-safe:flex items-center gap-5">
          <div aria-hidden="true" className="relative h-px flex-1 overflow-hidden bg-border">
            <div className="h-full origin-left bg-foreground scale-x-[var(--p,0)]" />
          </div>
          <ol aria-label="Build timeline in weeks" className="flex items-center gap-4 text-xs tracking-widest">
            {WEEK_TICKS.map((tick, index) => (
              <li key={tick.week} className="flex items-center gap-4">
                {index > 0 ? <span aria-hidden="true" className="h-px w-4 bg-border" /> : null}
                <span
                  className={cn(
                    "flex items-center gap-2 transition-colors duration-500",
                    index === activeTick ? "text-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {index === activeTick ? (
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[rgb(251,146,60)]" />
                  ) : null}
                  {tick.week}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Touch only: compare without hunting for the scroll trigger. */}
        <div className="mt-4 hidden motion-safe:pointer-coarse:flex items-center justify-center gap-2">
          {(["before", "after"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={phase === value}
              onClick={() => selectPhase(value)}
              className={cn(
                "border px-4 py-2 text-xs uppercase tracking-widest transition-colors duration-300",
                phase === value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
