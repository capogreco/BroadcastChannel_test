import { generate } from "https://deno.land/std@0.185.0/uuid/v1.ts"
import { generate_nickname } from "./nickname.js"

export class OverSock {
    constructor (sock, sock_id, serv_id) {
        this.et            = sock
        this.audio_enabled = false
        this.is_control    = false
        this.ping          = Date.now ()
        this.server        = serv_id
        this.id            = sock_id
    }
}