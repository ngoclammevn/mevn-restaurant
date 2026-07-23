<script setup>
import { ref, watch } from 'vue'
import { SignInModal } from '../ui'

const props = defineProps({
  open: Boolean,
  isSignedIn: Boolean,
})

const emit = defineEmits(['authenticated', 'cancel'])
const hasAuthenticated = ref(false)

watch(() => [props.open, props.isSignedIn], ([open, isSignedIn]) => {
  if (!open) {
    hasAuthenticated.value = false
    return
  }

  if (isSignedIn && !hasAuthenticated.value) {
    hasAuthenticated.value = true
    emit('authenticated')
  }
}, { immediate: true })

function cancel() {
  if (!props.isSignedIn) emit('cancel')
}
</script>

<template>
  <SignInModal v-if="open && !isSignedIn" @close="cancel" />
</template>
