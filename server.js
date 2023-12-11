import { serve }    from "https://deno.land/std@0.208.0/http/server.ts"
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts"
import { generate } from "https://deno.land/std@0.208.0/uuid/v1.ts"

const server_id = `s_${ generate () }`

const servers = new Map ()
servers.set (server_id, new Map ())

const channel = new BroadcastChannel (`server_channel`)

channel.onmessage = e => {
  console.log (e)
}

channel.postMessage (`hello, I guess?`)


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

      const id = generate ()

      // unwrap socket & response
      // using upgradeWebSocket method
      const { socket, response } = Deno.upgradeWebSocket (req)

      // defining an onopen method
      socket.onopen = () => {
         console.log (`socket opened!`)

         socket.audio_enabled = false

         servers.get(server_id).set (id, socket)
         console.log (servers)

         socket.send (JSON.stringify (servers, replacer))
      }

      // defining an onmessage method
      socket.onmessage = m => {

         // unwrap the message
         const msg = JSON.parse (m.data)

         console.log (`message recieved:`, msg)

      }

      // if there is an error
      // print it to the console
      socket.onerror = e => console.log(`socket error: ${ e.message }`)

      // on closing
      socket.onclose = () => {
         console.log (`socket closed`)
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
      fsRoot: `public`
   }

   // return the requested asset
   // from `public` folder
   return serveDir (req, options)

}

// start a server that handles requests at port 80
serve (req_handler, { port: 80 })

function replacer (key, value) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from (value.entries ()), // or with spread: value: [...value]
    }
  } else {
    return value
  }
}