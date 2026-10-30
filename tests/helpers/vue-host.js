import { createRenderer, defineComponent, h, reactive, ref } from 'vue'

// Run Vue lifecycle and component events without a browser or a DOM shim.
const renderer=createRenderer({
  createElement:tag=>({tag,tagName:tag.toUpperCase(),props:{},children:[],parent:null,addEventListener(){},removeEventListener(){}}),
  createText:text=>({text,parent:null}),createComment:comment=>({comment,parent:null}),
  setText:(node,text)=>{node.text=text},
  setElementText:(node,text)=>{node.text=text;node.children=[]},
  parentNode:node=>node.parent,
  nextSibling:node=>node.parent?.children[node.parent.children.indexOf(node)+1] || null,
  patchProp:(node,key,_previous,value)=>{node.props[key]=value;node[key]=value},
  insert(node,parent,anchor){
    if(node.parent){const index=node.parent.children.indexOf(node);if(index>=0)node.parent.children.splice(index,1)}
    node.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1
    if(index<0)parent.children.push(node);else parent.children.splice(index,0,node)
  },
  remove(node){if(node.parent){const index=node.parent.children.indexOf(node);if(index>=0)node.parent.children.splice(index,1);node.parent=null}},
})

export function mountHost(component,initialProps={}){
  const props=reactive({...initialProps}),instance=ref(null),root={children:[]}
  const app=renderer.createApp(defineComponent({setup:()=>()=>h(component,{...props,ref:instance})}))
  app.mount(root)
  return {get vm(){return instance.value},root,updateProps:patch=>Object.assign(props,patch),unmount:()=>app.unmount()}
}
export function hostText(node){return [node.text || '',...(node.children || []).map(hostText)].join('')}
export function hostFind(node,predicate){if(predicate(node))return node;for(const child of node.children || []){const match=hostFind(child,predicate);if(match)return match}return null}
