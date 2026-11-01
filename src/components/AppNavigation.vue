<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { desktopLinks, mobileLinks, isNavActive } from '../lib/navigation'
import GlassNavigation from './ui/liquid/GlassNavigation.vue'

const props = defineProps({ surface: { type: String, default: 'desktop' }, path: { type: String, required: true } })
const router = useRouter()
const links = computed(() => props.surface === 'mobile' ? mobileLinks : desktopLinks)
const activeIndex = computed(() => links.value.findIndex(link => isNavActive(link.to, props.path)))
</script>

<template>
  <nav :class="['app-navigation', 'app-navigation--' + surface]" :aria-label="surface === 'mobile' ? 'Điều hướng điện thoại' : 'Điều hướng chính'">
    <GlassNavigation :items="links" :active-index="activeIndex" :compact="surface === 'desktop'" :label="surface === 'mobile' ? 'Các trang chính' : 'Chọn trang'" @navigate="router.push($event)" />

  </nav>
</template>

<style>
.app-navigation--desktop { width:360px; flex:0 0 360px; min-height:52px; }
</style>
