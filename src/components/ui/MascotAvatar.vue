<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DIRECTIONS, REACTIONS, mascotAssets, spritePosition } from '../../lib/mascot-catalog'
import { registerMascotMotion } from '../../lib/mascot-motion'
import {
  getMascotEggEvent,
  hasUnlockedMascotEgg,
  markMascotEggUnlocked,
  MASCOT_EGG_UNLOCKED_EVENT,
} from '../../lib/mascot-events'

const props = defineProps({
  mascotId: { type: String, default: 'fox' },
  size: { type: [Number, String], default: 40 },
  label: { type: String, default: 'Mascot' },
  interactive: { type: Boolean, default: false },
})

const element = ref(null)
const squash = ref(null)
const direction = ref('center')
const reaction = ref(null)
const eggTaps = ref(0)
const eggHint = ref(false)
const eggCelebrating = ref(false)
const activeEggEvent = ref(getMascotEggEvent())
const eggUnlocked = ref(false)
const eggProgress = computed(() => Math.max(0, Math.min(4, eggTaps.value - 3)))
const celebrationParticles = computed(() => activeEggEvent.value.particles)
const avatarStyle = computed(() => ({
  width: String(props.size) + 'px',
  height: String(props.size) + 'px',
}))
const assets = computed(() => mascotAssets(props.mascotId))

let activeEventKey = activeEggEvent.value.eventKey
let dispose = () => {}
let active = false
let animation
let timer
let eggTimer
let eggEffectTimer

function stop() {
  clearTimeout(timer)
  timer = undefined
  animation?.cancel()
  animation = undefined
  reaction.value = null
}

function resetEggSequence() {
  clearTimeout(eggTimer)
  eggTimer = undefined
  eggTaps.value = 0
  eggHint.value = false
}

function syncActiveEggEvent() {
  const nextEvent = getMascotEggEvent()
  if (nextEvent.eventKey !== activeEventKey) {
    activeEventKey = nextEvent.eventKey
    activeEggEvent.value = nextEvent
    resetEggSequence()
    eggCelebrating.value = false
    clearTimeout(eggEffectTimer)
    eggEffectTimer = undefined
  }

  // Re-read on every tap so another mascot on this page shares the same unlock.
  eggUnlocked.value = hasUnlockedMascotEgg(activeEventKey)
}

function boop() {
  if (document.visibilityState === 'hidden') return
  syncActiveEggEvent()
  stop()
  reaction.value = 'heart'
  clearTimeout(eggTimer)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (active && !reduceMotion) {
    const celebrating = !eggUnlocked.value && eggTaps.value + 1 === 7
    animation = squash.value?.animate?.(celebrating ? [
      { transform: 'scale(1,1) rotate(0deg)' },
      { transform: 'translateY(-8px) scale(.78,1.16) rotate(-8deg)', offset: .22 },
      { transform: 'translateY(-2px) scale(1.12,.9) rotate(7deg)', offset: .5 },
      { transform: 'scale(.96,1.04) rotate(-3deg)', offset: .76 },
      { transform: 'scale(1,1) rotate(0deg)' },
    ] : [
      { transform: 'scale(1,1)' },
      { transform: 'scale(1.1,.86)', offset: .18 },
      { transform: 'scale(.95,1.08)', offset: .45 },
      { transform: 'scale(1.03,.97)', offset: .72 },
      { transform: 'scale(1,1)' },
    ], {
      duration: celebrating ? 760 : 420,
      easing: celebrating ? 'cubic-bezier(.2,.8,.2,1)' : 'linear',
    })
  }

  timer = setTimeout(stop, eggUnlocked.value ? 560 : eggTaps.value + 1 === 7 ? 900 : 560)
  if (eggUnlocked.value) return

  eggTaps.value += 1
  if (eggTaps.value === 3) eggHint.value = true

  if (eggTaps.value === 7) {
    markMascotEggUnlocked(activeEventKey)
    eggUnlocked.value = true
    resetEggSequence()
    eggCelebrating.value = true
    window.dispatchEvent(new CustomEvent(MASCOT_EGG_UNLOCKED_EVENT, {
      detail: { eventKey: activeEventKey, eventId: activeEggEvent.value.id },
    }))
    clearTimeout(eggEffectTimer)
    eggEffectTimer = setTimeout(() => {
      eggCelebrating.value = false
      eggEffectTimer = undefined
    }, 2400)
  } else {
    eggTimer = setTimeout(resetEggSequence, 8000)
  }
}

onMounted(() => {
  syncActiveEggEvent()
  dispose = registerMascotMotion(element.value, value => {
    direction.value = value
  }, {
    onActivity: value => {
      active = value
      if (!active) stop()
    },
  })
})

onUnmounted(() => {
  dispose()
  stop()
  resetEggSequence()
  clearTimeout(eggEffectTimer)
})
</script>

<template>
  <span class="mascot-avatar-wrap" :style="avatarStyle">
    <component
      :is="interactive ? 'button' : 'span'"
      ref="element"
      :type="interactive ? 'button' : undefined"
      :role="interactive ? undefined : 'img'"
      :aria-label="interactive ? 'Chạm ' + label : label"
      class="avatar mascot-avatar"
      :class="{
        'mascot-avatar--interactive': interactive,
        'mascot-avatar--celebrating': eggCelebrating,
      }"
      :style="avatarStyle"
      @click="boop"
    >
      <span ref="squash" class="mascot-squash">
        <span
          class="mascot-layer"
          :style="{
            backgroundImage: 'url(' + (reaction ? assets.reactions : assets.directions) + ')',
            backgroundPosition: spritePosition(
              reaction ? REACTIONS.indexOf(reaction) : DIRECTIONS.indexOf(direction),
            ),
          }"
        />
      </span>
    </component>

    <span v-if="eggHint" class="mascot-egg-message" role="status">
      <span>Còn {{ 7 - eggTaps }} lần nữa · {{ activeEggEvent.hint }} 👀</span>
      <span class="mascot-egg-progress" aria-hidden="true">
        <span v-for="step in 4" :key="step" :class="{ 'is-filled': step <= eggProgress }">♥</span>
      </span>
    </span>

    <span
      v-if="eggCelebrating"
      class="mascot-egg-burst"
      :class="'mascot-egg-burst--' + activeEggEvent.id"
      aria-hidden="true"
    >
      <span v-for="(particle, index) in celebrationParticles" :key="index">{{ particle }}</span>
    </span>

    <span v-if="eggCelebrating" class="mascot-egg-message mascot-egg-message--celebration" role="status">
      <strong>{{ activeEggEvent.title }}</strong>
      <span>{{ activeEggEvent.message }}</span>
    </span>
  </span>
</template>

<style scoped>
.mascot-avatar-wrap{position:relative;display:inline-flex;flex:0 0 auto;vertical-align:middle}
.mascot-avatar{position:relative;display:inline-block;flex-shrink:0;padding:0;border:0;border-radius:50%;background:var(--bg-tint,#f1f2ed);overflow:hidden;vertical-align:middle;user-select:none}
.mascot-avatar--interactive{cursor:pointer}
.mascot-squash{position:absolute;inset:5%;display:block;transform-origin:50% 78%}
.mascot-layer{position:absolute;inset:0;background-size:300% 300%;background-repeat:no-repeat}
.mascot-egg-message{position:absolute;z-index:20;left:50%;bottom:calc(100% + 8px);display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateX(-50%);padding:7px 9px;border:1px solid var(--line-strong);border-radius:12px;background:var(--card);box-shadow:0 4px 14px rgb(25 45 34 / 14%);color:var(--ink);font-size:12px;font-weight:700;line-height:1.2;max-width:min(260px,calc(100vw - 24px));white-space:normal;text-align:center;pointer-events:none;animation:mascot-egg-pop 180ms ease-out both}
.mascot-egg-progress{display:flex;gap:5px;color:#c5c9c5;font-size:11px}
.mascot-egg-progress .is-filled{color:#d85d76;animation:mascot-egg-fill 180ms ease-out both}
.mascot-egg-message--celebration{bottom:auto;top:calc(100% + 8px);padding:8px 11px;gap:2px;border-color:#ead8bf;background:linear-gradient(145deg,#fffdf7,#f9f0e3);text-align:center}
.mascot-egg-message--celebration strong{color:#8d5d17;font-size:12px}
.mascot-egg-message--celebration span{font-size:12px;font-weight:600;color:var(--ink-soft)}
.mascot-egg-burst{position:absolute;z-index:2;inset:-24px;pointer-events:none}
.mascot-egg-burst span{position:absolute;top:50%;left:50%;color:var(--heart-color);font-size:18px;line-height:1;opacity:0;animation:mascot-egg-burst 1050ms var(--heart-delay) cubic-bezier(.16,.8,.35,1) both;filter:drop-shadow(0 2px 3px rgb(25 45 34 / 14%))}
.mascot-egg-burst span:nth-child(1){--heart-x:-40px;--heart-y:-20px;--heart-rotation:-18deg;--heart-delay:0ms;--heart-color:#d85d76}
.mascot-egg-burst span:nth-child(2){--heart-x:-28px;--heart-y:-38px;--heart-rotation:12deg;--heart-delay:45ms;--heart-color:#e19a35}
.mascot-egg-burst span:nth-child(3){--heart-x:-8px;--heart-y:-44px;--heart-rotation:-8deg;--heart-delay:90ms;--heart-color:#176b44}
.mascot-egg-burst span:nth-child(4){--heart-x:18px;--heart-y:-40px;--heart-rotation:16deg;--heart-delay:30ms;--heart-color:#d85d76}
.mascot-egg-burst span:nth-child(5){--heart-x:39px;--heart-y:-18px;--heart-rotation:-12deg;--heart-delay:75ms;--heart-color:#e19a35}
.mascot-egg-burst span:nth-child(6){--heart-x:30px;--heart-y:12px;--heart-rotation:10deg;--heart-delay:120ms;--heart-color:#176b44}
.mascot-egg-burst span:nth-child(7){--heart-x:-28px;--heart-y:20px;--heart-rotation:-10deg;--heart-delay:60ms;--heart-color:#d85d76}
.mascot-egg-burst--hanoi-autumn span{filter:drop-shadow(0 2px 4px rgb(151 97 24 / 25%))}
.mascot-egg-burst--christmas span,.mascot-egg-burst--new-year span{filter:drop-shadow(0 2px 5px rgb(41 97 72 / 25%))}
.mascot-egg-burst--tet span,.mascot-egg-burst--national-day span{filter:drop-shadow(0 2px 5px rgb(185 53 44 / 28%))}
@keyframes mascot-egg-pop{from{opacity:0;translate:0 4px}to{opacity:1;translate:0 0}}
@keyframes mascot-egg-fill{from{transform:scale(.5)}to{transform:scale(1)}}
@keyframes mascot-egg-burst{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--heart-x)),calc(-50% + var(--heart-y))) rotate(var(--heart-rotation)) scale(1.2)}}
@media(prefers-reduced-motion:reduce){.mascot-egg-message,.mascot-egg-progress .is-filled,.mascot-egg-burst span{animation:none}.mascot-egg-burst{display:none}.mascot-avatar--celebrating .mascot-squash{transform:none}}
</style>
