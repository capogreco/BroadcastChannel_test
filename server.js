import { serve }    from "https://deno.land/std@0.185.0/http/server.ts"
import { serveDir } from "https://deno.land/std@0.185.0/http/file_server.ts"
import { generate } from "https://deno.land/std@0.185.0/uuid/v1.ts"
import { generate_nickname } from "./modules/nickname.js"

const server_name = generate_nickname (`server`)
const server_id   = generate ()
const sockets     = new Map ()
const servers     = new Map ()
let   control     = false

console.log (`${ server_name } booting up`)

const channel = new BroadcastChannel (`server_channel`)

channel.postMessage (
   JSON.stringify ({
      method: `check_in`,
      content: {
         name: server_name,
         id: server_id,
      }
   })
)

function send_info () {
   const msg = {
      method: `info`,
      content: {
         id: server_id,
         name: server_name,
         control: control ? true : false,
         sockets,
      }      
   }

   channel.postMessage (JSON.stringify (msg))
}



channel.onmessage = e => {
   const msg = JSON.parse (e.data)

   const manage = {
      send_info,

      info: () => {
         if (!control) return
         console.log (`${ server_name } is receiving info from ${ msg.content.name }`)
         servers.set (msg.content.id, msg.content)
         console.dir (servers)
      },

      check_in: () => {
         if (!control) return
         console.log (`${ msg.content.name } checking in`)

      }
   }

   manage[msg.method] ()
}



// function to manage requests
const req_handler = async incoming_req => {

   let req = incoming_req

   // get path from request
   const path = new URL (req.url).pathname

   // get upgrade header
   // or empty string
   const upgrade = req.headers.get ("upgrade") || ""

   // if upgrade for websockets exists
   if (upgrade.toLowerCase () == "websocket") {

      // unwrap socket & response
      // using upgradeWebSocket method
      const { socket, response } = Deno.upgradeWebSocket (req)

      // generate a unique ID
      const id = generate ()
      const name = generate_nickname (`synth`)

      // defining an onopen method
      socket.onopen = () => {

         // assign false to 
         // audio_enabled property
         socket.audio_enabled = false

         // assign ID information to socket
         socket.id     = id
         socket.name   = name
         socket.server = {
            name: server_name,
            id: server_id,
         }

         // add socket to map
         sockets.set (id, socket)

         // bundle, stringify, & send ID
         // to the synth via the socket 
         socket.send (JSON.stringify ({ 
            method : `info`,
            content :  { 
               id, 
               name,
               server: {
                  id : server_id,
                  name: server_name,
               }
            }
         }))

         // call update_control function
         update_control ()
      }

      // defining an onmessage method
      socket.onmessage = m => {

         // unwrap the message
         const msg = JSON.parse (m.data)

         // object housing methods for
         // managing incoming msgs
         const manage_incoming = {

            // method for requests for control
            request_control: () => {

               // if control is empty
               if (!control) {

                  // assign this socket
                  // to control
                  control = socket

                  // assign the ID
                  // to the socket
                  control.id = id

                  // delete the socket
                  // from the sockets map
                  sockets.delete (id)

                  // call update_control
                  update_control ()

                  // print success to console
                  console.log (`${ control.id } has control.`)

                  channel.postMessage (JSON.stringify ({
                     method: `send_info`
                  }))
               }

               // or print fail to console
               else console.log (`${ id } wants control!`)
            },


            // method for joining
            join: () => {

               // update .joined property on socket
               socket.joined = msg.content

               // print to console:
               console.log (`${ id } has joined ${ server_name }!`)

               // call update_control
               update_control ()
            },

            greeting: () => {
               console.log (msg.content)
            }
         }

         // use the .method property of msg
         // to choose which method to call
         // console.log (msg)
         manage_incoming[msg.method] ()
      }

      // if there is an error
      // print it to the console
      socket.onerror = e => console.log(`socket error: ${ e.message }`)

      // on closing
      socket.onclose = () => {

         // if there is a control socket
         if (control) {

            // .. and it matches the closing socket
            if (control.id == id) {

               // empty the control variable
               control = false
            }
         }

         // otherwise
         else {

            // delete it from the sockets map
            sockets.delete (id)

            // .. and update control
            update_control ()
         }
      }

      // respond to websocket request
      return response
   }

   // if there is no filename in the url
   if (req.url.endsWith (`/`)) {

      // add 'index.html' to the url
      req = new Request (`${ req.url }index.html`, req)
   }

   const options = {

      // route requests to this
      // directory in the file system
      fsRoot: path.includes (`ctrl`) ? `` : `synth`
   }

   // return the requested asset
   // from `public` folder
   return serveDir (req, options)

}

// start a server that handles requests at port 80
serve (req_handler, { port: 80 })

// function to keep ctrl up to date
function update_socket_list () {
   // construct a msg object
   const msg = {

      // method is 'sockets'
      method: 'sockets',

      // contents is the list of
      // sockets in array form
      content: Array.from (sockets.entries ())
   }

}

function update_control () {
   if (control) {
      control.send (JSON.stringify ({
         method: `list`,
         content: {
            servers,
            sockets,
         }
      }))
   }
   else send_info ()
}

// function to check for closed sockets
function check_sockets () {

   // empty array for putting 
   // sockets to be removed
   const removals = []

   // for each socket in sockets
   sockets.forEach ((s, id) => {

      // if the .readystate
      // property is 2 or 3
      if (s.readyState > 1) {

         // add its ID to the removals array
         removals.push (id)
      }
   })

   // if there is anything in the removals array
   if (removals.length) {

      // for each id in the removals array
      removals.forEach (id => {

         // delete the corresponding socket
         sockets.delete (id)
      })

      // update ctrl
      update_control ()
   }
}

// check sockets 3 times a second
setInterval (check_sockets, 333)
