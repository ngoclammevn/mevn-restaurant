<script setup>
const items = [
  { to: '/', label: 'Hôm nay', icon: '🍱' },
  { to: '/post', label: 'Đăng menu', icon: '＋' },
  { to: '/history', label: 'Đơn của tôi', icon: '◷' },
  { to: '/manage/menus', label: 'Quản lý', icon: '☰' },
]
</script>

<template>
  <nav class="bottom-nav" aria-label="Điều hướng chính">
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="bottom-nav__item"
    >
      <span class="bottom-nav__icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>
