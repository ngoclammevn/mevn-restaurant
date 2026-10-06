<script setup>
import { ref } from 'vue'
defineProps({ errors: { type: Array, default: () => [] } })
const panel = ref(null)
function focusField(id) { document.getElementById(id)?.focus() }
defineExpose({ focus: () => panel.value?.focus() })
</script>
<template><section v-if="errors.length" ref="panel" class="alert" tabindex="-1" role="alert" aria-label="Kiểm tra thông tin"><p><strong>Kiểm tra các thông tin sau:</strong></p><ul><li v-for="(error,index) in errors" :key="error.fieldId || index"><button type="button" class="error-link" @click="focusField(error.fieldId)">{{ error.message }}</button></li></ul></section></template>
<style scoped>.error-link{border:0;background:none;color:inherit;text-decoration:underline;text-align:left;min-height:44px;padding:4px 0;cursor:pointer}ul{padding-left:20px;margin:8px 0 0}</style>
