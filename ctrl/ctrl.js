// ~ WEBSOCKET THINGS ~
const info = {}
let all_clear = true

function give_all_clear () {
   all_clear = true
}

function wait_for_clear () {
   all_clear = false
   setTimeout (give_all_clear, 200)
}


const ws_address = `wss://polite-gecko-95.deno.dev`
// const ws_address = `ws://localhost/`

const socket = new WebSocket (ws_address)

socket.onmessage = m => {
   const msg = JSON.parse (m.data, reviver)

   const handle_incoming = {
      id: () => {
         Object.assign (info, msg.content)
         console.log (`id = ${ info.id.no }`)
         console.log (` ... but call me ${ info.id.name }`)
         console.log (`receiving service from ${ info.server.name }`)

         socket.send (JSON.stringify ({
            method: `request_control`,
            content: info.id,
         }))
      },

      list: () => {
         console.log (`list:`)
         console.dir (msg)

         socket_list.textContent = ``
      
         msg.content.forEach (serv => {
            const serv_div = document.createElement (`div`)
            serv_div.innerText = serv.id.name
            serv_div.style.width      = `100%`
            serv_div.style.marginLeft = `0%`
            serv_div.style.userSelect = `none`
            serv_div.style.color = `grey`
            socket_list.appendChild (serv_div)

            s.sockets.forEach (sock => {
               const sock_div = document.createElement (`div`)
               sock_div.innerText = sock.id.name
               sock_div.style.width      = `92%`
               sock_div.style.marginLeft = `8%`
               sock_div.style.userSelect = `none`
               sock_div.style.color = `grey`
               socket_list.appendChild (sock_div)
            })
         })
      }
   }

   console.log (`${ msg.method } message recieved`)
   handle_incoming[msg.method] ()
}


socket.onopen = m => {
   console.log (`websocket at ${ m.target.url } is ${ m.type }`)
}

// ~ UI THINGS ~

document.body.style.margin   = 0
document.body.style.overflow = `hidden`
document.body.style.touchAction = `none`
document.body.style.overscrollBehavior = `none`

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

const cnv = document.getElementById (`cnv`)
cnv.width  = innerWidth
cnv.height = innerHeight

const ctx = cnv.getContext (`2d`)
ctx.fillStyle = `indigo`
ctx.fillRect (0, 0, cnv.width, cnv.height)

window.onresize = () => {
   cnv.width  = innerWidth
   cnv.height = innerHeight
   background ()

   socket_list.style.width      = `${ innerWidth }px`
   socket_list.style.height     = `${ innerHeight }px`         
}

let pointer_down = false

function background () {
   ctx.fillStyle = `indigo`
   ctx.fillRect (0, 0, cnv.width, cnv.height)
}

function draw_square (e) {
   ctx.fillStyle = `lime`
   ctx.fillRect (e.x - 50, e.y - 50, 100, 100)
}

document.body.onpointerdown = e => {

   pointer_down = true

   socket.send (JSON.stringify ({
      method: `upstate`,
      content: {
         x: e.x / cnv.width,
         y: e.y / cnv.height,
         is_playing: true,
      }
   }))

   background ()
   draw_square (e)
   
}

document.body.onpointermove = e => {
   if (pointer_down) {
      background ()

      const pos = {
         x: e.x ? e.x : e.touches[0].clientX,
         y: e.y ? e.y : e.touches[0].clientY
      }

      draw_square (pos)

      if (all_clear) {
         socket.send (JSON.stringify ({
            method: `upstate`,
            content: {
               x: pos.x / cnv.width,
               y: pos.y / cnv.height,
               is_playing: true,
            }
         }))
         wait_for_clear ()
      }
   }
}


// document.body.ontouchmove = e => {

// }


document.body.onpointerup = e => {
   pointer_down = false

   background ()

   socket.send (JSON.stringify ({
      method: `upstate`,
      content: {
         is_playing: false,
      }
   }))
}


function reviver (key, value) {
   if (typeof value === `object` && value !== null) {
      if (value.dataType === `Map`) {
         return new Map (value.value)
      }
   }
   return value
}
