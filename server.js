import { serve      } from "https://deno.land/std@0.185.0/http/server.ts"
import { ServerNode } from "./modules/ServerNode.js"

const server = new ServerNode ()
serve (server.req_handler.bind (server), { port: 80 })