import { afterEach, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountHost, hostFind, hostText } from '../helpers/vue-host.js'
vi.mock('../../src/components/ui',async()=>{const {h}=await import('vue');return {AppButton:(_props,{slots,attrs})=>h('button',attrs,slots.default?.())}})
vi.mock('../../src/components/ui/liquid/GlassInput.vue',async()=>{const {h}=await import('vue');return {default:{props:['modelValue'],emits:['update:modelValue','blur'],setup(props,{emit,attrs}){return()=>h('input',{...attrs,value:props.modelValue,onInput:event=>emit('update:modelValue',event.target.value),onBlur:()=>emit('blur')})}}}})
import MenuReminderField from '../../src/components/MenuReminderField.vue'
let host
const values=[]
afterEach(()=>{host?.unmount();values.length=0})
function mount(modelValue=null){host=mountHost(MenuReminderField,{menuDate:'2026-10-31',modelValue,'onUpdate:modelValue':value=>{values.push(value);host.updateProps({modelValue:value})}})}
test('preset uses menu day in Vietnam regardless of machine timezone',async()=>{mount();hostFind(host.root,node=>node.tag==='button'&&hostText(node)==='10:45').props.onClick();await nextTick();expect(values).toEqual(['2026-10-31T03:45:00.000Z'])})
test('midnight stays on the menu day in Vietnam and invalid time keeps previous selection',async()=>{mount('2026-10-30T17:00:00.000Z');let input=hostFind(host.root,node=>node.tag==='input');expect(input.props.value).toBe('00:00');input.props.onInput({target:{value:'25:90'}});await nextTick();input=hostFind(host.root,node=>node.tag==='input');input.props.onBlur();await nextTick();expect(values).toEqual([]);expect(hostText(host.root)).toContain('App giữ giờ 00:00');expect(hostFind(host.root,node=>node.tag==='input').props.value).toBe('00:00')})
test('switching off clears the ISO value',async()=>{mount('2026-10-31T03:45:00.000Z');hostFind(host.root,node=>node.tag==='button'&&hostText(node)==='Tắt nhắc').props.onClick();await nextTick();expect(values).toEqual([null]);expect(hostText(host.root)).toContain('Chưa bật lịch nhắc')})
