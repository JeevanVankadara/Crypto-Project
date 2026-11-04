package main
import("bufio";"fmt";"os";"academicvault/cryptohelper/internal/engine")
func main(){s:=bufio.NewScanner(os.Stdin);s.Buffer(make([]byte,4096),16*1024*1024);for s.Scan(){fmt.Println(string(engine.Handle(s.Bytes())))};if s.Err()!=nil{os.Exit(1)}}
