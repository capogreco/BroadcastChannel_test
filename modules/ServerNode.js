import { serveDir } from "https://deno.land/std@0.185.0/http/file_server.ts"
import { generate } from "https://deno.land/std@0.185.0/uuid/v1.ts"
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
            afferent: this.manage_afferent,
            efferent: this.manage_efferent
         }
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
      if (!this.control) return
      const manage_method = {
         check_in : this.manage_check_in,
         info     : this.manage_info,
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
         request_info   : this.send_info,
         send_to_socket : this.send_to_socket,
      }
      manage_method[msg.method] (msg)
   }

   send_info () {
      const msg = {
         type    : `afferent`,
         method  : `info`,
         content : this,      
      }
      this.channel.postMessage (JSON.stringify (msg, replacer))
   }

   check_sockets () {
      const removals = []
      this.sockets.forEach ((s, id) => {
         if (s.readyState > 1) {
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
      const path = new URL (req.url).pathname
      const upgrade = req.headers.get ("upgrade") || ""
      if (upgrade.toLowerCase () == "websocket") {

         const { socket, response } = Deno.upgradeWebSocket (req)

         socket.onopen = () => {
            socket.audio_enabled = false
            socket.ping          = Date.now ()
            socket.server        = this.id
            socket.id            = {
               no   : generate (),
               name : generate_nickname (`synth`),
            }
   
            this.sockets.set (this.id.no, socket)
            this.socket.send (JSON.stringify ({
               method  : `id`,
               content :  socket,
            }), replacer)
            this.update_control ()

            console.log (`${ socket.id.name } has joined ${ this.id.name }!`)
         }

         socket.onmessage = m => {   
            const msg = JSON.parse (m.data, reviver)
            const manage_incoming = {
               request_control: () => {
                  if (!control) {
                     control = socket
                     sockets.delete (socket.id)
                     update_control ()
                     channel.postMessage (JSON.stringify ({
                        method: `request_info`
                     }))
                     let self_copy = JSON.stringify(this, replacer)
                     self_copy = JSON.parse (self_copy, reviver)
                     this.servers.set (this.id.no, self_copy)
                     console.log (`${ control.id } has control.`)
                  }
                  else console.log (`${ id } wants control!`)
               },

               pong: () => {
                  socket.ping -= Date.now () 
                  socket.ping /= 2
                  socket.ping = Math.floor (socket.ping)
                  console.log (`${ socket.id.name }'s ping is ${ socket.ping }ms`)
               },

               ready: () => {
                  socket.audio_enabled = true
                  update_control ()
               },   
            }
            manage_incoming[msg.method] ()
         }
   
         socket.onerror = e => console.log(`socket error: ${ e.message }`)
         socket.onclose = () => {
            if (control) {
               if (control.id == id) {
                  control = false
               }
            }
   
            else {
               sockets.delete (id)
               update_control ()
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
         this.control.send (JSON.stringify ({
            method  : `list`,
            content : this.servers
         }, replacer))
      }
      else this.send_info ()
   }

}

