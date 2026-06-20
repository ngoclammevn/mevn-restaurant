<script setup>
import { ref } from 'vue'
import { useOCR } from '../composables/useOCR'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select-meal'])

const { loading, progress, statusText, errorMsg, detectedMeals, recognizeMenu } = useOCR()
const isExpanded = ref(false)

async function handleExtract() {
  isExpanded.value = true
  if (detectedMeals.value.length === 0 && !loading.value) {
    await recognizeMenu(props.imageUrl)
  }
}

function selectMeal(meal) {
  emit('select-meal', meal.name)
}
</script>

<template>
  <div class="ocr-helper">
    <!-- Trigger Button -->
    <div v-if="!isExpanded" class="ocr-trigger">
      <button 
        type="button" 
        class="ocr-btn-trigger"
        @click="handleExtract"
      >
        <span class="sparkle">✨</span> Chọn món nhanh từ ảnh menu
      </button>
    </div>

    <!-- Active OCR Workspace -->
    <div v-else class="ocr-workspace">
      <div class="ocr-header">
        <span class="ocr-title">🤖 Trích xuất món ăn từ ảnh</span>
        <button 
          type="button" 
          class="ocr-close-btn"
          @click="isExpanded = false"
        >
          Thu gọn
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="ocr-loading-container">
        <div class="ocr-progress-bar-bg">
          <div class="ocr-progress-bar" :style="{ width: `${progress * 100}%` }"></div>
        </div>
        <p class="ocr-status">{{ statusText }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="errorMsg" class="ocr-error">
        <p>{{ errorMsg }}</p>
        <button 
          type="button" 
          class="btn btn--ghost btn--sm" 
          @click="recognizeMenu(props.imageUrl)"
        >
          Thử lại
        </button>
      </div>

      <!-- Results list -->
      <div v-else class="ocr-results">
        <p class="ocr-hint">💡 Bấm vào món dưới đây để điền nhanh:</p>
        
        <div v-if="detectedMeals.length > 0" class="ocr-meals-grid">
          <button
            v-for="(meal, idx) in detectedMeals"
            :key="idx"
            type="button"
            class="ocr-meal-tag"
            @click="selectMeal(meal)"
          >
            <span class="meal-name">{{ meal.name }}</span>
            <span v-if="meal.price" class="meal-price">{{ meal.price }}</span>
          </button>
        </div>
        
        <div v-else class="ocr-empty">
          <p>Không nhận diện được món ăn nào. Có thể ảnh quá mờ hoặc bố cục quá phức tạp.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ocr-helper {
  margin-top: 0.5rem;
  margin-bottom: 0.8rem;
}

.ocr-btn-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--primary-soft);
  color: var(--primary-ink);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.8rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ocr-btn-trigger:hover {
  background: var(--line);
  transform: translateY(-1px);
}

.ocr-btn-trigger:active {
  transform: translateY(0);
}

.ocr-workspace {
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.8rem;
  animation: slideDown 0.25s ease-out;
}

.ocr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px dashed var(--line);
}

.ocr-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--ink-soft);
}

.ocr-close-btn {
  background: transparent;
  border: none;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
}

.ocr-close-btn:hover {
  color: var(--ink);
}

.ocr-loading-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
  align-items: center;
}

.ocr-progress-bar-bg {
  width: 100%;
  height: 6px;
  background: var(--bg-tint);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.ocr-progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-pill);
  transition: width 0.2s ease;
}

.ocr-status {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
  font-style: italic;
  text-align: center;
}

.ocr-error {
  text-align: center;
  color: var(--accent);
  font-size: var(--fs-sm);
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.ocr-hint {
  font-size: var(--fs-xs);
  color: var(--muted);
  margin-top: 0;
  margin-bottom: 0.6rem;
}

.ocr-meals-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.ocr-meal-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--card);
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-pill);
  padding: 0.35rem 0.7rem;
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.ocr-meal-tag:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary-ink);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}

.ocr-meal-tag:active {
  transform: translateY(0);
}

.meal-name {
  color: var(--ink);
  font-weight: 600;
}

.ocr-meal-tag:hover .meal-name {
  color: var(--primary-ink);
}

.meal-price {
  background: var(--bg-tint);
  color: var(--ink-soft);
  font-size: var(--fs-xs);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  font-weight: 700;
}

.ocr-meal-tag:hover .meal-price {
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary-soft);
}

.ocr-empty {
  font-size: var(--fs-sm);
  color: var(--muted);
  text-align: center;
  padding: 0.8rem;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
