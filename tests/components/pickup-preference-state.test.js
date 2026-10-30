import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mountHost, hostFind, hostText } from '../helpers/vue-host.js'
const state=vi.hoisted(()=>({user:null,api:null}))
vi.mock('@clerk/vue',()=>({useUser:()=>({user:state.user})}))
vi.mock('../../src/composables/usePickup',()=>({usePickup:()=>state.api}))
vi.mock('../../src/components/ui',async()=>{const {h}=await import('vue');return {AppButton:(_props,{slots,attrs})=>h('button',attrs,slots.default?.())}})
import PickupPreferenceForm from '../../src/components/PickupPreferenceForm.vue'
let host
beforeEach(()=>{state.user=ref({id:'user_a'});state.api={getPreferences:vi.fn(async()=>({data:{contact:{phone_e164:'+84901234567'},availability:{available:false}},error:null})),savePreferences:vi.fn()}})
afterEach(()=>host?.unmount())
test('switching accounts while saving clears private phone and unlocks the new account form',async()=>{
 let finish
 state.api.savePreferences.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 host=mountHost(PickupPreferenceForm,{date:'2026-10-30'})
 await vi.waitFor(()=>expect(hostText(host.root)).toContain('+84901234567'))
 hostFind(host.root,node=>node.tag==='button'&&hostText(node)==='Thay đổi').props.onClick();await nextTick()
 hostFind(host.root,node=>node.tag==='input'&&node.props.type==='radio').props['onUpdate:modelValue'](true)
 const pending=host.vm.save();await nextTick()
 expect(hostFind(host.root,node=>node.tag==='fieldset').props.disabled).toBe(true)
 state.api.getPreferences.mockResolvedValue({data:{contact:{phone_e164:'+84987654321'},availability:{available:false}},error:null})
 state.user.value={id:'user_b'}
 await vi.waitFor(()=>expect(hostText(host.root)).toContain('+84987654321'))
 expect(hostText(host.root)).not.toContain('+84901234567')
 hostFind(host.root,node=>node.tag==='button'&&hostText(node)==='Thay đổi').props.onClick();await nextTick()
 expect(hostFind(host.root,node=>node.tag==='fieldset').props.disabled).toBe(false)
 finish({error:null});await pending;await nextTick()
 expect(hostText(host.root)).not.toContain('+84901234567')
})
