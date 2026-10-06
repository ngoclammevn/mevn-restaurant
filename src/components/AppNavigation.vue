<script setup>
import { computed } from 'vue'
import { desktopLinks, mobileLinks, isNavActive } from '../lib/navigation'
import AppIcon from './ui/AppIcon.vue'
const props = defineProps({ surface: { type: String, default: 'desktop' }, path: { type: String, required: true } })
const links = computed(() => props.surface === 'mobile' ? mobileLinks : desktopLinks)
</script>
<template><nav :class="['app-navigation', 'app-navigation--' + surface]" :aria-label="surface === 'mobile' ? 'Điều hướng điện thoại' : 'Điều hướng chính'"><router-link v-for="link in links" :key="link.to" :to="link.to" class="nav-link" :class="{ 'is-active': isNavActive(link.to,path) }" :aria-current="isNavActive(link.to,path) ? 'page' : undefined"><AppIcon :name="link.icon" /><span>{{ link.label }}</span></router-link></nav></template>
