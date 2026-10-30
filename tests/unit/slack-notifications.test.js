import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { mountHost } from '../helpers/vue-host.js'
vi.mock('@clerk/vue', () => ({ useSession: () => ({ session: currentSession }) }))
import { useLunchApi } from '../../src/lib/lunch-api'
import { useSlackNotifications } from '../../src/composables/useSlackNotifications'
let currentSession
let mounted=[]
beforeEach(() => { currentSession = ref({ id: 'session-a', getToken: async () => 'jwt-a' }); vi.stubEnv('VITE_AI_API_BASE_URL', 'https://worker.example.test') })
afterEach(() => { for(const host of mounted)host.unmount();mounted=[];vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
function notifications(){let api;const host=mountHost({setup(){api=useSlackNotifications();return()=>null}});mounted.push(host);return api}
test('Lunch API uses current session JWT with fixed worker origin and no cookies', async () => {
 const fetcher = vi.fn(async (url, options) => {
  expect(url).toBe('https://worker.example.test/v1/slack/publish')
  expect(options.credentials).toBe('omit'); expect(options.redirect).toBe('error')
  expect(options.headers.Authorization).toBe('Bearer jwt-a')
  expect(JSON.parse(options.body)).toEqual({menu_id:'menu-a'})
  return Response.json({status:'sent',eventId:'event-a'})
 })
 vi.stubGlobal('fetch',fetcher)
 expect(await useLunchApi().callLunchApi('/v1/slack/publish',{menu_id:'menu-a'})).toEqual({status:'sent',eventId:'event-a'})
})
test('logout and foreign paths fail before fetch',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 const {callLunchApi}=useLunchApi()
 await expect(callLunchApi('https://attacker.test',{})).rejects.toMatchObject({code:'invalid_path'})
 currentSession.value=null
 await expect(callLunchApi('/v1/slack/publish',{})).rejects.toMatchObject({code:'unauthenticated'})
 expect(fetcher).not.toHaveBeenCalled()
})
test('slow responses after switching accounts cannot update new account',async()=>{
 let finish
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const pending=useLunchApi().callLunchApi('/v1/slack/publish',{})
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
 currentSession.value={id:'session-b',getToken:async()=>'jwt-b'}
 finish(Response.json({status:'sent'}))
 await expect(pending).rejects.toMatchObject({code:'session_changed'})
})
test('missing config, explicit API errors and already-aborted requests stay failures',async()=>{
 const {callLunchApi}=useLunchApi()
 vi.stubEnv('VITE_AI_API_BASE_URL','http://insecure.example.test')
 await expect(callLunchApi('/v1/slack/publish',{})).rejects.toMatchObject({code:'service_not_configured'})
 vi.stubEnv('VITE_AI_API_BASE_URL','https://worker.example.test')
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'forbidden'},{status:403})))
 await expect(callLunchApi('/v1/slack/publish',{})).rejects.toMatchObject({code:'forbidden',status:403})
 const controller=new AbortController();controller.abort()
 await expect(callLunchApi('/v1/slack/publish',{}, {signal:controller.signal})).rejects.toMatchObject({code:'request_interrupted'})
})
test.each(['closed','reopened','pickup-changed','received','share','reminder'])('retries the original %s action after interruption before an event ID exists',async action=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({status:'sent',eventId:'new-event'}))
 vi.stubGlobal('fetch',fetcher)
 const api=notifications(),call={closed:()=>api.notifyClosure({menu_id:'menu-a',revision:2}),reopened:()=>api.notifyReopened('menu-a'),'pickup-changed':()=>api.notifyPickupChanged('menu-a'),received:()=>api.notifyReceived('menu-a'),share:()=>api.shareMenu('menu-a'),reminder:()=>api.syncReminder('menu-a')}[action]
 await call()
 await api.retryPending('menu-a')
 expect(fetcher.mock.calls[1][0]).toBe(`https://worker.example.test/v1/slack/${action}`)
 expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[0][1].body)
})
test('a new action cannot inherit an older action event ID; durable retries use the registry event',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({status:'sent',eventId:'published-event'}))
  .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({status:'retryable',eventId:'closed-event'}))
  .mockResolvedValueOnce(Response.json({status:'sent',eventId:'closed-event'}))
 vi.stubGlobal('fetch',fetcher)
 const api=notifications()
 await api.publishMenu('menu-a');await api.notifyClosure({menu_id:'menu-a',revision:3})
 expect(api.states.value['menu-a'].eventId).toBeUndefined()
 await api.retryPending('menu-a');await api.retryPending('menu-a')
 expect(fetcher.mock.calls[2][0]).toMatch(/\/closed$/)
 expect(fetcher.mock.calls[3][0]).toMatch(/\/retry$/)
 expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({event_id:'closed-event'})
})
test('switching sessions clears remembered pending actions',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
 const api=notifications();await api.notifyReceived('menu-a')
 currentSession.value={id:'session-b',getToken:async()=>'jwt-b'}
 await vi.waitFor(()=>expect(api.states.value).toEqual({}))
 const count=fetch.mock.calls.length
 await api.retryPending('menu-a')
 expect(fetch).toHaveBeenCalledTimes(count)
})
