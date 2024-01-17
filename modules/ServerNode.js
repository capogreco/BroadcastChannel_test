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
      if (!this.control) return
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
         content : this,      
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
         console.log (`socket is ${ socket }`)

         socket.onopen = () => {
            socket.audio_enabled = false
            console.log (`socket.audio_enabled is ${ socket.audio_enabled }`)

            socket.control       = { 
               exists : false,
               id     : {   },
            }
            console.log (`socket.control is ${ socket.control }`)

            socket.ping          = Date.now ()
            console.log (`socket.ping is ${ socket.ping }`)

            socket.server        = this.id
            console.log (`socket.server is ${ socket.server }`)

            socket.id            = {
               no   : generate (),
               name : generate_nickname (`synth`),
            }
            console.log (`socket.id is ${ socket.id }`)

            console.log (`${ this.id.name } is opening a socket with ${ socket.id.name }`)
            console.dir (socket)
            this.sockets.set (this.id.no, socket)
            socket.send (JSON.stringify ({
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
                  if (!this.control.exists) {
                     console.log (`request_control called in ${ this.id.name }`)   
                     console.log (`socket.audio_enabled is ${ socket.audio_enabled }`)
                     console.log (`socket.ping is ${ socket.ping }`)
                     console.log (`socket.server is ${ socket.server }`)
                     console.log (`socket.control is ${ socket.control }`)
                     console.log (socket)
                     Object.assign (this.control.id, socket.id)
                     this.control.exists = true
                     this.channel.postMessage (JSON.stringify ({
                        type   : `efferent`,
                        method : `request_info`,
                     }))
                     this.update_servers ()
                     this.update_control ()
                     console.log (`${ this.control.id.name } has control.`)
                  }
                  else console.log (`${ id } wants control!`)
               },

               pong: () => {
                  socket.ping = Date.now () - socket.ping
                  socket.ping /= 2
                  socket.ping = Math.floor (socket.ping)
                  console.log (`${ socket.id.name }'s ping is ${ socket.ping }ms`)
                  this.update_control ()
               },

               ready: () => {
                  socket.audio_enabled = true
                  this.update_control ()
               },   
            }
            console.log (msg.method)
            manage_incoming[msg.method] ()
         }
   
         socket.onerror = e => console.log(`socket error: ${ e.message }`)
         socket.onclose = () => {
            if (this.control) {
               console.dir (this.control)
               if (this.control.id.no == socket.id.no) {
                  this.control = false
               }
            }
   
            else {
               this.sockets.delete (socket.id.no)
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
      if (this.control.exists) {
         this.control.send (JSON.stringify ({
            method  : `list`,
            content : this.servers
         }, replacer))
      }
      else this.send_info ()
   }

   update_servers () {
      console.log (`${ this.id.name } is updating servers`)
      this.servers.set (this.id.no, { ...this })
      console.dir (this.servers)
   }

}

