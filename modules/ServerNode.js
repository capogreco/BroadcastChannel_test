import { serveDir } from "https://deno.land/std@0.185.0/http/file_server.ts"
import { generate } from "https://deno.land/std@0.185.0/uuid/v1.ts"
import { OverSock } from "./OverSock.js"
import { generate_nickname } from "./nickname.js"
import { replacer, reviver } from "./replacer.js"

export class ServerNode {
   constructor () {

      this.id   = {
         name : generate_nickname (`server`),
         no   : generate (),
      }

      this.sockets = new Map ()
      this.servers = new Map ()
      this.control = false

      console.log (`${ this.id.name } booting up`)

      this.channel = new BroadcastChannel (`server_node_channel`)
      this.channel.onmessage = e => {
         const msg = JSON.parse (e.data, reviver)
         const manage_type = {
            afferent: this.manage_afferent.bind (this),
            efferent: this.manage_efferent.bind (this)
         }
         console.log (`${ this.id.name } recieved ${ msg.type } message`)
         manage_type[msg.type] (msg)
      }
      this.channel.postMessage (
         JSON.stringify ({
            type    : `afferent`,
            method  : `check_in`,
            content : this.id
         })
      )

      setInterval (this.check_sockets.bind (this), 200)
   }

   manage_afferent (msg) {
      if (!this.control.id.no) return
      const manage_method = {
         check_in : this.manage_check_in.bind (this),
         info     : this.manage_info.bind (this),
      }
      manage_method[msg.method] (msg)
   }

   manage_check_in (msg) {
      this.servers.set (msg.content.id, msg.content) 
      console.log (`${ msg.content.name } checking into ${ this.server_name }`)
   }

   manage_info (msg) {
      this.servers.set (msg.content.id.no, msg.content)
      this.update_control ()
   }

   manage_efferent (msg) {
      const manage_method = {
         request_info   : this.send_info.bind (this),
         send_to_socket : this.send_to_socket.bind (this),
      }
      manage_method[msg.method] (msg)
   }

   send_info () {
      const msg = {
         type    : `afferent`,
         method  : `info`,
         content : {
            id: this.id,
            sockets: this.sockets,
         },      
      }
      this.channel.postMessage (JSON.stringify (msg, replacer))
   }

   send_to_socket (msg) {
      const socket = this.sockets.get (msg.content.id.no)
      if (socket) {
         socket.send (JSON.stringify (msg.content, replacer))
      }
   }

   check_sockets () {
      const removals = []
      this.sockets.forEach ((sock, id) => {
         if (sock.et.readyState > 1) {
            removals.push (id)
         }
      })
      if (removals.length) {
         removals.forEach (id => {
            this.sockets.delete (id)
         })
         this.update_control ()
      }
   }

   async req_handler (incoming_req) {
      let req = incoming_req
      let id = {
         no   : false,
         name : false
      }
      let sock

      const path = new URL (req.url).pathname
      const upgrade = req.headers.get ("upgrade") || ""

      if (upgrade.toLowerCase () == "websocket") {
         
         const { socket, response } = Deno.upgradeWebSocket (req)

         socket.onopen = () => {
            id.no   = req.headers.get (`sec-websocket-key`)
            id.name = generate_nickname (`synth`)
            sock    = new OverSock (socket, id, this.id.no)

            this.sockets.set (sock.id.no, sock)

            sock.et.send (JSON.stringify ({
               method  : `id`,
               content :  { 
                  id: sock.id,
                  server: this.id
               },
            }), replacer)
            this.update_control ()

            console.log (`${ sock.id.name } has joined ${ this.id.name }!`)
         }

         socket.onmessage = m => {   
            const msg = JSON.parse (m.data, reviver)
            const manage_incoming = {
               request_control: () => {
                  if (!this.control) {
                     // console.dir (msg)
                     this.control = this.sockets.get (msg.content.no)
                     this.channel.postMessage (JSON.stringify ({
                        type   : `efferent`,
                        method : `request_info`,
                     }))
                     // this.update_servers ()
                     this.update_control ()
                     // console.dir (this.control)
                     console.log (`${ this.control.id.name } has control.`)
                  }
                  else console.log (`${ id } wants control!`)
               },

               pong: () => {
                  sock.ping = Date.now () - sock.ping
                  sock.ping /= 2
                  sock.ping = Math.floor (sock.ping)
                  console.log (`${ id.name }'s ping is ${ sock.ping }ms`)
                  this.update_control ()
               },

               ready: () => {
                  socket.audio_enabled = true
                  this.update_control ()
               },   
            }
            manage_incoming[msg.method] ()
         }
   
         socket.onerror = e => console.log(`socket error: ${ e.message }`)
         socket.onclose = () => {
            if (this.control) {
               // console.dir (this.control)
               if (this.control.id.no == id) {
                  this.control = false
               }
            }
   
            else {
               this.sockets.delete (id)
               this.update_control ()
            }
         }
         return response
      }
   
      if (req.url.endsWith (`/`)) {   
         req = new Request (`${ req.url }index.html`, req)
      }
   
      const options = {
         fsRoot: path.includes (`ctrl`) ? `` : `synth`
      }
      return serveDir (req, options)   
   }   

   update_control () {
      if (this.control) {
         if (this.control.et.readyState > 1) {
            this.control = false
            this.update_control ()
            return
         }
         this.control.et.send (JSON.stringify ({
            method  : `list`,
            content : {
               id      : this.id,
               sockets : this.sockets,
               servers : this.servers,
            }
         }, replacer))
      }
      else this.send_info ()
   }

   // update_servers () {
   //    console.log (`${ this.id.name } is updating servers`)
   //    console.dir (this.servers)
   // }

}

