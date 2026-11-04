//go:build js && wasm

package main
import("syscall/js";"encoding/json";"academicvault/cryptohelper/internal/engine")
func main(){f:=js.FuncOf(func(this js.Value,args []js.Value)any{
 if len(args)!=1{return `{"error":"Invalid request"}`};input:=[]byte(args[0].String());var op struct{Op string `json:"op"`};_ =json.Unmarshal(input,&op)
 if op.Op!="encrypt"&&op.Op!="decrypt" {return `{"error":"Authority operations are unavailable in the browser"}`}
 return string(engine.Handle(input))
});js.Global().Set("academicABE",f);select{}}
