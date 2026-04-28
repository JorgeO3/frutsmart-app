# Unified Animation System - Component Details

## 1. Overlays (modals, dialogs, …)

### Modal / Dialog / AlertDialog
**Main Animation:**
* opacity: 0 → 1
* scale: 0.9 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied as the master pattern)
* Exit Animation: opacity 1 → 0, scale 1 → 0.9 (300 ms, Easing.inOut(Easing.quad))

**Micro‑interactions:**
* On inner content (buttons, etc.): Follow their local rules.

**Justification:**
* Opacity + scale is the dominant pattern in iOS and Material.
* 300 ms fits with Material Design's “surface transition” guidelines.

### Alert
**Main Animation:**
* Master pattern (opacity 0 → 1, scale 0.9 → 1, 300 ms, Easing.inOut(Easing.quad))

**“Banner” variant (appears from the top edge):**
* translateY: -32 → 0
* opacity: 0 → 1
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Exit Animation (“banner” variant):**
* translateY: 0 → -32
* opacity: 1 → 0
* Duration: 200 ms
* Easing: withTiming on UI thread

**Micro‑interactions:**
* Swipe to dismiss:
    * translateY: 0 → -32
    * opacity: 1 → 0
    * Duration: 200 ms
    * Easing: withTiming on UI thread

**Justification:**
* Reduces overlap with the status bar (“banner” variant).
* 200 ms = Material Design's recommendation for small exits (“banner” variant).

### Toast / Sonner
**Main Animation:**
* opacity: 0 → 1
* scale: 0.95 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied as an overlay)

**“Stacked” option (entry):**
* translateY: 8 → 0
* Duration: Implied in the main animation (300 ms)
* Easing: Easing.inOut(Easing.quad) (implied)

**Exit Animation:**
* opacity: 1 → 0
* scale: 1 → 0.95
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interactions:**
* Horizontal swipe to dismiss:
    * translateX: 0 → ±fullWidth
    * Easing: withSpring({ damping: 18 })

**Justification:**
* Animating scale avoids flickering when mounting.
* Natural swipe with high spring preserves 60 fps UI thread Callstack.

### Popover / HoverCard / Tooltip
**Main Animation (entry):**
* opacity: 0 → 1
* translateY: -4 → 0
* Duration: 150 ms
* Easing: Easing.inOut(Easing.quad) (implied as an overlay)

**Exit Animation:**
* opacity: 1 → 0
* translateY: 0 → -4
* Duration: 150 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interactions:**
* 300 ms delay before showing Tooltip.
* If the pointer leaves before, it is canceled.

**Justification:**
* 150 ms is the standard for web/mobile thumbprint.design tooltips.
* Slight translation provides direction without breaking the master rhythm.

### DatePicker Modal
**Main Animation (container):**
* opacity: 0 → 1
* scale: 0.9 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied as an overlay)
* Exit Animation: opacity 1 → 0, scale 1 → 0.9 (300 ms, Easing.inOut(Easing.quad))

**Internal selector animation (wheels, calendar):**
* Follows the rules of section 3 (Inputs and Controls) for the internal calendar.

**Micro‑interactions:**
* None specified for the modal container.

**Justification:**
* Separates “overlay” from “inner transition”, maintains cognitive hierarchy.

## 2. Collapsible Structures & Menus

### Accordion / Collapsible
**Main Animation:**
* height: auto (with withTiming)
* Duration: 200 ms
* Target measurement: uses `measure`
* opacity: 0 → 1
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied)
* Arrow icon:
    * rotation: 0° → 90°
    * Duration: 150 ms
    * Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interactions:**
* Highlights header when opening:
    * backgroundColor alpha: 0 → 0.04
    * Duration: 75 ms
    * Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* `translateY` discarded; `height-tween` + `fade` produces a sense of push without overlapping content.

### Combobox / Select / Dropdown / ContextMenu
**Main Animation (panels):**
* opacity: 0 → 1
* scale: 0.95 → 1
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied as a mini-overlay)
* Exit Animation: opacity 1 → 0, scale 1 → 0.95 (200 ms, Easing.inOut(Easing.quad))

**Micro‑interactions:**
* Winning option highlights on touch:
    * scale: 0.97 → 1
    * backgroundColor tone change: Implied (75 ms, Easing.inOut(Easing.quad))
    * Duration: 75 ms
    * Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Small panel → we shortened 300 ms to 200 ms for freshness, maintaining master easing.

### Menubar / NavigationMenu
**Main Animation (Submenu):**
* opacity: 0 → 1
* translateY: -6 → 0
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Active indicator animation:**
* translateX: Animated
* width: Animated
* Duration: 150 ms
* Easing: withSpring({ damping: 20 })

**Micro‑interactions (web):**
* Hover modifies background bar opacity:
    * opacity: 0 → 0.08
    * Duration: 75 ms
    * Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Similar to Material & macOS, provides continuity between tabs and menus.

## 3. Inputs and Controls

### Button
**Main Animation / State (Press in):**
* scale: 1 → 0.97
* opacity: 1 → 0.9
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Main Animation / State (Release):**
* scale: 0.97 → 1
* opacity: 0.9 → 1
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Success / error ripple):**
* radial scale: 0 → 1.2
* opacity: 0.2 → 0
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* 100 ms meets Material Design's tactile feedback guidelines.

### Checkbox / Radio
**Main Animation (Checkmark):**
* scale: 0 → 1
* opacity: 0 → 1
* Duration: 120 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Main Animation (Un‑check):**
* scale: 1 → 0
* Duration: Implied (120 ms)
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (“Mixed” state):**
* scale: 0 → 1.1 → 1
* Easing: withSpring()

**Justification:**
* Short and expressive, uses `withSpring` for imperceptible overshoot.

### Switch / Toggle / ToggleGroup
**Main Animation (Thumb):**
* translateX: Between extremes
* Duration: 150 ms
* Easing: withTiming()

**Main Animation (Track):**
* backgroundColor: Crossfade
* Duration: 150 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Main Animation (ToggleGroup - active item):**
* scale: 0.95 → 1
* opacity: 0.6 → 1
* Duration: Implied (150 ms)
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction:**
* Audible vibration (haptic) synchronized on toggle.

**Justification:**
* 150 ms is the iOS/Android standard for toggles.

### Slider / Progress
**Main Animation (Thumb drag):**
* translateX: Animated
* Easing: withSpring({ stiffness: 180 })

**Main Animation (Value bar on release):**
* width: Animated
* Duration: 150 ms
* Easing: withTiming()

**Micro‑interaction:**
* On‑drag display tooltip (see section 1) with value.

**Justification:**
* `translateX` maintains 60 fps.
* `spring` adjusts to human release.

### Tabs
**Main Animation (Content - tab change):**
* translateX: ±16 → 0
* opacity: 0 → 1
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Main Animation (Indicator):**
* translateX: Animated to match active tab
* width: Animated to match active tab
* Duration: 150 ms
* Easing: withTiming()

**Micro‑interaction (Press indicator):**
* scaleX: 1 → 0.9
* Duration: 75 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Based on Material guidelines.

### Calendar (internal)
**Main Animation (Month change):**
* translateX: ±%width → 0
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Main Animation (Day selection):**
* circle scale: 0 → 1
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Current day):**
* opacity: 0.5 ↔ 1 (blink)
* Number of cycles: 2
* Duration per cycle: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Complex but harmonized with 300 ms main rhythm.

## 4. Content & Visual Feedback

### Avatar
**Initial Animation (Lazy‑load):**
* opacity: 0 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Initial Animation (Fallback letter):**
* scale: 0.9 → 1
* Duration: Simultaneous with Lazy-load (300 ms)
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Touch):**
* translateZ simulated with shadowRadius: 0 → 2
* Duration: 75 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Progressive loading conveys stability.

### Badge
**Initial Animation (Appears):**
* scale: 0.6 → 1
* opacity: 0 → 1
* Duration: 150 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Count change - number):**
* translateY: 4 → 0
* opacity: 0 → 1
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Small → brief animation.
* Scale emphasizes arrival.

### Card
**Initial Animation (Ready entry):**
* opacity: 0 → 1
* scale: 0.98 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)
* shadowOpacity: 0 → 0.24
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (OnPress):**
* scale: 1 → 0.97
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)
* elevation: 4 → 8 (synchronized)
* Duration: 100 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Justification:**
* Cohesive with Button feedback.
* Shadow boost gives “depth step”.

### Carousel
**Main Animation (Transition between slides):**
* translateX: According to direction
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)
* opacity (new slide): 0.4 → 1
* Duration: 300 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Fling inertia):**
* translateX: Animated
* Easing: withSpring({ damping: 15, mass: 1 })

**Justification:**
* X-axis scrolling maintains timeline continuity.

### Skeleton
**Initial Animation (Alpha pulse):**
* opacity: 0.6 ↔ 1
* Cycle duration: 800 ms
* Easing: withTiming()
* Repetition: repeat-reverse

**Initial Animation (Backdrop shimmer):**
* translateX: -100% → 100%
* Cycle duration: 1000 ms
* Repetition: loop

**Micro‑interactions:**
* None specified.

**Justification:**
* Constant cycle maintains perception of loading.

### Pagination
**Main Animation (Active):**
* dot scale: 1 → 1.2 → 1
* opacity: 0.4 → 1
* Duration: 200 ms
* Easing: Easing.inOut(Easing.quad) (implied)

**Micro‑interaction (Page change via swipe):**
* Reuses Carousel animation.

**Justification:**
* Dot breathing attracts attention without distractions.

## 5. Recommended Reanimated Functions

* **Timed entrances/exits:** `withTiming(duration, { easing })`
* **Subtle bounces (checkbox overshoot, swipe dismiss):** `withSpring({ damping, stiffness })`
* **Dynamic re-measurement (Accordion height):** `useAnimatedRef`, `measure`, `withTiming`
* **Repetitions (Skeleton):** `withRepeat(withTiming(...), -1, true)`
* **Animated styles:** `useAnimatedStyle`, `interpolate` for gestures