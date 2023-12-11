const ws_address = `wss://polite-gecko-95.deno.dev`

const socket = new WebSocket (ws_address)
socket.onmessage = m => {
   const msg = JSON.parse (m.data, reviver)
   socket_list.innerText = ``
   msg.forEach ((v, k) => {

      const server_text = document.createElement (`div`)
      server_text.style.font       = `14 px`
      server_text.style.fontFamily = 'monospace'
      server_text.style.color      = `white`
      server_text.style.display    = `block`
      server_text.style.position   = `static`
      server_text.style.width      = `${ innerWidth }px`
      server_text.style.left       = 0
      server_text.style.top        = 0
      server_text.innerText = `${ k }`
      socket_list.append (server_text)

      v.forEach ((sock, j) => {
         const socket_text = document.createElement (`div`)
         socket_text.style.font       = `14 px`
         socket_text.style.fontFamily = 'monospace'
         socket_text.style.color      = `white`
         socket_text.style.display    = `block`
         socket_text.style.position   = `static`
         socket_text.style.width      = `${ innerWidth }px`
         socket_text.style.left       = 0
         socket_text.style.top        = 0
         socket_text.innerText = `\v \v ${ j }`
         socket_list.append (socket_text)
      })
   })
}

// ~ UI THINGS ~

document.body.style.margin   = 0
document.body.style.overflow = `hidden`
document.body.style.touchAction = `none`
document.body.style.overscrollBehavior = `none`
document.body.style.backgroundColor = `indigo`

// document.body.style.backgroundColor = `indigo`

const socket_list            = document.createElement (`div`)
socket_list.style.font       = `14 px`
socket_list.style.fontFamily = 'monospace'
socket_list.style.color      = `white`
socket_list.style.display    = `block`
socket_list.style.position   = `fixed`
socket_list.style.width      = `${ innerWidth }px`
socket_list.style.height     = `${ innerHeight }px`
socket_list.style.left       = 0
socket_list.style.top        = 0
document.body.appendChild (socket_list)

function reviver(key, value) {
   if(typeof value === 'object' && value !== null) {
     if (value.dataType === 'Map') {
       return new Map(value.value);
     }
   }
   return value;
 }