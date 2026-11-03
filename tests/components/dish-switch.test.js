import { afterEach, expect, test, vi } from 'vitest'
import { mountHost, hostFind } from '../helpers/vue-host.js'
vi.mock('../../src/components/ui',async()=>{const {h}=await import('vue');return {AppButton:(_props,{slots,attrs})=>h('button',attrs,slots.default?.())}})
vi.mock('../../src/components/ui/liquid/GlassSwitch.vue',async()=>{const {h}=await import('vue');return {default:{props:['modelValue','disabled'],emits:['update:modelValue','change'],setup(props,{emit}){return()=>h('button',{role:'switch',disabled:props.disabled,'aria-checked':props.modelValue,onClick:()=>{if(!props.disabled){emit('update:modelValue',!props.modelValue);emit('change',!props.modelValue)}}},'switch')}}}})
import ManageDishTable from '../../src/components/ManageDishTable.vue'
let host
const calls=[]
afterEach(()=>{host?.unmount();calls.length=0})
function mount(closed=false,busy=false){host=mountHost(ManageDishTable,{menu:{is_closed:closed,menu_items:[{id:'dish-a',name:'Cơm gà',price:35000,available:true}]},summary:{orderedDishes:[]},busy,onAvailability:(...args)=>calls.push(args)})}
test('availability switch sends the new availability exactly once',()=>{mount();const toggle=hostFind(host.root,node=>node.tag==='button'&&node.props.role==='switch');expect(toggle.props['aria-checked']).toBe(true);toggle.props.onClick();expect(calls).toHaveLength(1);expect(calls[0][0].id).toBe('dish-a');expect(calls[0][1]).toBe(false)})
test.each([[true,false],[false,true]])('closed or busy menus disable availability changes (%s,%s)',(closed,busy)=>{mount(closed,busy);const toggle=hostFind(host.root,node=>node.tag==='button'&&node.props.role==='switch');expect(toggle.props.disabled).toBe(true);toggle.props.onClick();expect(calls).toHaveLength(0)})
