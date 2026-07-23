<script setup>
import { UserButton } from '@clerk/vue'

const emit = defineEmits(['show-changelog'])
</script>

<template>
  <UserButton>
    <UserButton.MenuItems>
      <UserButton.Link href="/profile" label="Hồ sơ">
        <template #labelIcon>
          <span aria-hidden="true">👤</span>
        </template>
      </UserButton.Link>
      <UserButton.Action label="Có gì mới" :on-click="() => emit('show-changelog')">
        <template #labelIcon>
          <span aria-hidden="true">✨</span>
        </template>
      </UserButton.Action>
    </UserButton.MenuItems>
  </UserButton>
</template>
