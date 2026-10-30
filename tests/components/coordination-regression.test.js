import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mountHost, hostFind, hostText } from '../helpers/vue-host.js'
const state=vi.hoisted(()=>({user:null,setClosed:null,getMenu:null,rpc:null,apis:[],close:null,confirmClose:null,pickupChanged:null}))
vi.mock('@clerk/vue',()=>({useUser:()=>({user:state.user})}))
vi.mock('../../src/composables/useMenus',()=>({useMenus:()=>({setMenuClosed:state.setClosed,getMenu:state.getMenu})}))
vi.mock('../../src/lib/supabase',()=>({useSupabaseClient:()=>({rpc:state.rpc})}))
vi.mock('../../src/composables/useSlackNotifications',async()=>{
 const {ref}=await import('vue')
 return {useSlackNotifications:()=>{const api={states:ref({})};for(const name of ['notifyClosure','notifyReopened','notifyReceived','notifyPickupChanged','syncReminder','syncPendingForMyMenus','retryPending','retryEvent','resolveEvent','publishMenu','shareMenu'])api[name]=vi.fn(async()=>({status:'pending'}));state.apis.push(api);return api}}
})
vi.mock('../../src/components/CloseMenuDialog.vue',()=>({default:{props:['open','busy','error'],setup(props,{emit}){state.close=props;state.confirmClose=value=>emit('confirm',value);return()=>null}}}))
vi.mock('../../src/components/MenuPickupPanel.vue',()=>({default:{setup(_props,{emit}){state.pickupChanged=kind=>emit('changed',kind);return()=>null}}}))
vi.mock('../../src/components/MenuClosureHistory.vue',()=>({default:{render:()=>null}}))
vi.mock('../../src/components/MenuReminderField.vue',()=>({default:{render:()=>null}}))
vi.mock('../../src/components/SlackDeliveryStatus.vue',()=>({default:{render:()=>null}}))
vi.mock('../../src/components/SlackPublishDialog.vue',()=>({default:{render:()=>null}}))
vi.mock('../../src/components/ui',async()=>{const {h}=await import('vue');return {AppButton:(_props,{slots,attrs})=>h('button',attrs,slots.default?.())}})
import MenuCoordination from '../../src/components/MenuCoordination.vue'
let host
const menu=()=>({id:'menu-a',poster_id:'user_a',is_closed:false,menu_date:'2026-10-30',reminder_at:null})
beforeEach(()=>{state.user=ref({id:'user_a'});state.setClosed=vi.fn();state.getMenu=vi.fn();state.rpc=vi.fn();state.apis=[];vi.stubGlobal('confirm',()=>true)})
afterEach(()=>{host?.unmount();host=null;vi.unstubAllGlobals()})
function mount(menuValue=menu()){host=mountHost(MenuCoordination,{menu:menuValue});return host}
function reminderButton(){return hostFind(host.root,node=>node.tag==='button'&&hostText(node)==='Lưu lịch nhắc')}
test('a committed close with a failed refresh closes the dialog, blocks copy and still notifies',async()=>{
 state.setClosed.mockResolvedValue({committed:true,data:null,error:null,refreshError:new Error('offline'),closureResult:{menu_id:'menu-a',revision:2}})
 mount();const copied=host.vm.closeMenu();await nextTick();state.confirmClose({allowUnassigned:true})
 await expect(copied).resolves.toBe(false)
 expect(state.close.open).toBe(false)
 expect(state.apis[0].notifyClosure).toHaveBeenCalledWith({menu_id:'menu-a',revision:2})
 expect(hostText(host.root)).toContain('Đã chốt')
 expect(hostText(host.root)).not.toContain('Chưa chốt được')
})
test('copy is allowed only after the updated closure snapshot has reached the parent',async()=>{
 const closed={...menu(),is_closed:true,current_closure_id:'closure-1',current_closure:{id:'closure-1',revision:1,items:[{unit_price:35000}]}}
 state.setClosed.mockResolvedValue({committed:true,data:closed,error:null,closureResult:{menu_id:'menu-a',revision:1}})
 mount();host.updateProps({onUpdated:value=>host.updateProps({menu:value})})
 const copied=host.vm.closeMenu();await nextTick();state.confirmClose({allowUnassigned:true})
 await expect(copied).resolves.toBe(true)
 expect(hostText(host.root)).toContain('Lần chốt 1')
})
test('a committed reopen remains success and notifies when the refresh failed',async()=>{
 state.setClosed.mockResolvedValue({committed:true,data:null,error:null,refreshError:new Error('offline')})
 mount({...menu(),is_closed:true})
 await expect(host.vm.reopenMenu()).resolves.toBe(true)
 expect(state.apis[0].notifyReopened).toHaveBeenCalledWith({menu_id:'menu-a'})
 expect(hostText(host.root)).toContain('Đã mở lại')
})
test('an acknowledged reminder is delivered even when reloading the menu throws',async()=>{
 state.rpc.mockResolvedValue({data:{reminder_at:'2026-10-30T04:00:00Z'},error:null});state.getMenu.mockRejectedValue(new Error('offline'))
 mount();await reminderButton().props.onClick()
 expect(state.apis[2].syncReminder).toHaveBeenCalledWith('menu-a')
 expect(hostText(host.root)).toContain('Đã lưu')
 expect(hostText(host.root)).not.toContain('Chưa lưu được giờ nhắc')
})
test('an acknowledged pickup change still notifies when menu refresh throws',async()=>{
 state.getMenu.mockRejectedValue(new Error('offline'))
 mount();state.pickupChanged('received')
 await vi.waitFor(()=>expect(state.apis[0].notifyReceived).toHaveBeenCalledWith({menu_id:'menu-a'}))
 expect(hostText(host.root)).toContain('Đã lưu')
})
test('switching the menu resets savingReminder and old completion cannot unlock the new request',async()=>{
 let finishOld,finishNew
 state.rpc.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve})).mockImplementationOnce(()=>new Promise(resolve=>{finishNew=resolve}))
 state.getMenu.mockResolvedValue({data:{...menu(),id:'menu-b'},error:null})
 mount();const old=reminderButton().props.onClick();await nextTick()
 expect(reminderButton().props.loading).toBe(true)
 host.updateProps({menu:{...menu(),id:'menu-b'}});await nextTick()
 expect(reminderButton().props.loading).toBe(false)
 const current=reminderButton().props.onClick();await nextTick()
 finishOld({error:null});await old;await nextTick()
 expect(reminderButton().props.loading).toBe(true)
 finishNew({error:null});await current;await nextTick()
 expect(reminderButton().props.loading).toBe(false)
 expect(state.apis[2].syncReminder).toHaveBeenCalledExactlyOnceWith('menu-b')
})
