package engine
import("crypto/aes";"crypto/cipher";"crypto/rand";"encoding/json";"runtime";"time";"sort";"fmt")
type Timing struct { Mean float64 `json:"meanMs"`; Median float64 `json:"medianMs"`; Min float64 `json:"minMs"`; Max float64 `json:"maxMs"` }
func summarize(v []float64)Timing{sort.Float64s(v);var sum float64;for _,x:=range v{sum+=x};return Timing{sum/float64(len(v)),v[len(v)/2],v[0],v[len(v)-1]}}
func Benchmark() (any,error){
 s,e:=Execute(Request{Op:"setup"});if e!=nil{return nil,e};setup:=s.(map[string]any);p:=setup["public"].(Public);m:=setup["master"].(Master)
 rows:=[]map[string]any{}
 for _,setting:=range [][2]int{{1024,3},{102400,3},{1048576,3},{1024,5},{1024,9}} {
  size,leaves:=setting[0],setting[1];data:=make([]byte,size);rand.Read(data)
  policy:="student_23cs101 OR (role_faculty AND dept_cse)";attrs:=[]string{"role_faculty","dept_cse"}
  for i:=3;i<leaves;i++ {attr:=fmt.Sprintf("access_%d",i);policy="("+policy+") AND "+attr;attrs=append(attrs,attr)}
  k,e:=Execute(Request{Op:"keygen",Public:p,Master:m,Attributes:attrs});if e!=nil{return nil,e}
  aesKey:=make([]byte,32);rand.Read(aesKey);block,_:=aes.NewCipher(aesKey);gcm,_:=cipher.NewGCM(block)
  be,bd,ae,ad:=[]float64{},[]float64{},[]float64{},[]float64{};var abeBytes,baseBytes int
  for trial:=-2;trial<7;trial++ {
   start:=time.Now();nonce:=make([]byte,12);rand.Read(nonce);ct:=gcm.Seal(nil,nonce,data,[]byte("benchmark-file"));baseEnc:=float64(time.Since(start).Nanoseconds())/1e6
   start=time.Now();plain,err:=gcm.Open(nil,nonce,ct,[]byte("benchmark-file"));if err!=nil||len(plain)!=size{return nil,denied};baseDec:=float64(time.Since(start).Nanoseconds())/1e6
   start=time.Now();v,err:=Execute(Request{Op:"encrypt",Public:p,Policy:policy,FileID:"benchmark-file",Filename:"grades.pdf",Data:data});if err!=nil{return nil,err};abeEnc:=float64(time.Since(start).Nanoseconds())/1e6
   env:=v.(Envelope);start=time.Now();_,err=Execute(Request{Op:"decrypt",Public:p,Key:k.(UserKey),Envelope:env});if err!=nil{return nil,err};abeDec:=float64(time.Since(start).Nanoseconds())/1e6
   packed,_:=json.Marshal(env);abeBytes=len(packed);normal,_:=json.Marshal(map[string]any{"version":1,"algorithm":"AES-256-GCM","nonce":nonce,"tag":ct[len(ct)-16:],"ciphertext":ct[:len(ct)-16]});baseBytes=len(normal)
   if trial>=0 {be=append(be,baseEnc);bd=append(bd,baseDec);ae=append(ae,abeEnc);ad=append(ad,abeDec)}
  }
  rows=append(rows,map[string]any{"inputBytes":size,"policyLeaves":leaves,"baselineEncrypt":summarize(be),"baselineDecrypt":summarize(bd),"abeEncrypt":summarize(ae),"abeDecrypt":summarize(ad),"baselineStoredBytes":baseBytes,"abeStoredBytes":abeBytes})
 }
 return map[string]any{"measuredAt":time.Now().UTC().Format(time.RFC3339),"runtime":runtime.Version(),"os":runtime.GOOS,"architecture":runtime.GOARCH,"repetitions":7,"warmups":2,"rows":rows,"method":"Both algorithms measured in the same Go WebAssembly runtime hosted in Node.js. Baseline is AES-256-GCM with an already-held server key; ABE is FAME protecting a fresh AES-256-GCM key. Timings exclude disk, MongoDB, network, helper startup and outer JSON encoding. These are crypto-core comparisons, not website response times. Seven repetitions after two warmups; synthetic random payloads."},nil
}
