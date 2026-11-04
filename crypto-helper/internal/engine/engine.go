// Package engine implements the project's hybrid encryption using the existing
// GoFE FAME CP-ABE scheme. It does not implement a new ABE primitive.
package engine

import (
 "crypto/aes"
 "crypto/cipher"
 "crypto/rand"
 "crypto/sha256"
 "encoding/base64"
 "encoding/hex"
 "encoding/json"
 "errors"
 "math/big"
 "regexp"
 "strings"

 "github.com/fentec-project/bn256"
 "github.com/fentec-project/gofe/abe"
)

type Public struct { G2 [2][]byte `json:"g2"`; GT [2][]byte `json:"gt"` }
type Master struct { Int [4]string `json:"int"`; G1 [3][]byte `json:"g1"` }
type UserKey struct {
 PublicID string `json:"publicId"`
 Attributes []string `json:"attributes"`
 K0 [3][]byte `json:"k0"`
 K [][3][]byte `json:"k"`
 Prime [3][]byte `json:"prime"`
}
type Capsule struct { C0 [3][]byte `json:"c0"`; C [][3][]byte `json:"c"`; Prime []byte `json:"prime"`; Sym []byte `json:"sym"`; IV []byte `json:"iv"` }
type Header struct {
 Version int `json:"version"`
 Scheme string `json:"scheme"`
 PublicID string `json:"publicId"`
 Policy string `json:"policy"`
 FileID string `json:"fileId"`
 Filename string `json:"filename"`
 Capsule Capsule `json:"capsule"`
}
type Envelope struct { Header Header `json:"header"`; Nonce []byte `json:"nonce"`; Ciphertext []byte `json:"ciphertext"` }
type Request struct {
 Op string `json:"op"`
 Public Public `json:"public"`
 Master Master `json:"master"`
 Key UserKey `json:"key"`
 Attributes []string `json:"attributes"`
 Policy string `json:"policy"`
 FileID string `json:"fileId"`
 Filename string `json:"filename"`
 Data []byte `json:"data"`
 Envelope Envelope `json:"envelope"`
}
var denied = errors.New("Decryption failed: the key does not satisfy the policy, or the encrypted package is invalid.")
func must(err error) { if err != nil { panic(err) } }
func p1(b []byte) *bn256.G1 { if len(b)!=64 { panic(denied) }; p:=new(bn256.G1); _,e:=p.Unmarshal(b); must(e); return p }
func p2(b []byte) *bn256.G2 { if len(b)!=129 { panic(denied) }; p:=new(bn256.G2); _,e:=p.Unmarshal(b); must(e); return p }
func pt(b []byte) *bn256.GT { if len(b)!=384 { panic(denied) }; p:=new(bn256.GT); _,e:=p.Unmarshal(b); must(e); return p }
func fingerprint(p Public) string { b,_:=json.Marshal(p); h:=sha256.Sum256(b);return hex.EncodeToString(h[:]) }
func publicNative(p Public) *abe.FAMEPubKey { n:=new(abe.FAMEPubKey);for i:=0;i<2;i++ { n.PartG2[i]=p2(p.G2[i]); n.PartGT[i]=pt(p.GT[i]) };return n }
func masterNative(m Master) *abe.FAMESecKey { n:=new(abe.FAMESecKey);for i:=0;i<4;i++ {v,ok:=new(big.Int).SetString(m.Int[i],10);if !ok||v.Sign()<=0||v.Cmp(bn256.Order)>=0 {panic(denied)};n.PartInt[i]=v};for i:=0;i<3;i++ { n.PartG1[i]=p1(m.G1[i]) };return n }
var attributePattern=regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
func validateAttributes(a []string) {if len(a)<1||len(a)>16 {panic(denied)};seen:=map[string]bool{};for _,s:=range a {if !attributePattern.MatchString(s)||seen[s] {panic(denied)};seen[s]=true}}
func policyNative(policy string) *abe.MSP {
 if len(policy)<1||len(policy)>512 {panic(denied)}
 tokens:=strings.Fields(strings.NewReplacer("("," ",")"," ").Replace(policy));attrs:=[]string{}
 for _,token:=range tokens {if token!="AND"&&token!="OR" {attrs=append(attrs,token)}}
 validateAttributes(attrs)
 m,e:=abe.BooleanToMSP(policy,false);must(e);return m
}
func keyNative(k UserKey) *abe.FAMEAttribKeys {
 validateAttributes(k.Attributes);if len(k.K)!=len(k.Attributes){panic(denied)}
 n:=&abe.FAMEAttribKeys{K:make([][3]*bn256.G1,len(k.K)),AttribToI:map[string]int{}}
 for i:=0;i<3;i++ {n.K0[i]=p2(k.K0[i]);n.KPrime[i]=p1(k.Prime[i])}
 for j,a:=range k.Attributes { n.AttribToI[a]=j;for i:=0;i<3;i++ {n.K[j][i]=p1(k.K[j][i])} };return n
}
func capsuleWire(c *abe.FAMECipher) Capsule {
 w:=Capsule{C:make([][3][]byte,len(c.Ct)),Prime:c.CtPrime.Marshal(),Sym:c.SymEnc,IV:c.Iv}
 for i:=0;i<3;i++ {w.C0[i]=c.Ct0[i].Marshal()};for j:=range c.Ct {for i:=0;i<3;i++ {w.C[j][i]=c.Ct[j][i].Marshal()}};return w
}
func capsuleNative(w Capsule,policy string) *abe.FAMECipher {
 m:=policyNative(policy);if len(w.C)!=len(m.Mat)||len(w.IV)!=16||len(w.Sym)!=48 {panic(denied)}
 c:=&abe.FAMECipher{Ct:make([][3]*bn256.G1,len(w.C)),CtPrime:pt(w.Prime),Msp:m,SymEnc:w.Sym,Iv:w.IV}
 for i:=0;i<3;i++ {c.Ct0[i]=p2(w.C0[i])};for j:=range w.C {for i:=0;i<3;i++ {c.Ct[j][i]=p1(w.C[j][i])}};return c
}
func Execute(r Request) (result any, err error) {
 defer func(){if recover()!=nil {result=nil;err=denied}}()
 a:=abe.NewFAME()
 switch r.Op {
 case "benchmark":return Benchmark()
 case "setup":
  p,m,e:=a.GenerateMasterKeys();must(e);pw:=Public{};mw:=Master{};for i:=0;i<4;i++ {mw.Int[i]=m.PartInt[i].String()}
  for i:=0;i<2;i++ {pw.G2[i]=p.PartG2[i].Marshal();pw.GT[i]=p.PartGT[i].Marshal()};for i:=0;i<3;i++ {mw.G1[i]=m.PartG1[i].Marshal()}
  return map[string]any{"public":pw,"master":mw,"publicId":fingerprint(pw)},nil
 case "keygen":
  validateAttributes(r.Attributes);k,e:=a.GenerateAttribKeys(r.Attributes,masterNative(r.Master));must(e)
  w:=UserKey{PublicID:fingerprint(r.Public),Attributes:r.Attributes,K:make([][3][]byte,len(k.K))}
  for i:=0;i<3;i++ {w.K0[i]=k.K0[i].Marshal();w.Prime[i]=k.KPrime[i].Marshal()};for j:=range k.K {for i:=0;i<3;i++ {w.K[j][i]=k.K[j][i].Marshal()}}
  return w,nil
 case "encrypt":
  if len(r.Data)>5*1024*1024||len(r.FileID)>80||len(r.Filename)>150||len(r.FileID)==0 {panic(denied)}
  key:=make([]byte,32);_,e:=rand.Read(key);must(e)
  cap,e:=a.Encrypt(base64.StdEncoding.EncodeToString(key),policyNative(r.Policy),publicNative(r.Public));must(e)
  h:=Header{1,"FAME-AES-256-GCM",fingerprint(r.Public),r.Policy,r.FileID,r.Filename,capsuleWire(cap)}
  aad,e:=json.Marshal(h);must(e);block,e:=aes.NewCipher(key);must(e);gcm,e:=cipher.NewGCM(block);must(e)
  nonce:=make([]byte,gcm.NonceSize());_,e=rand.Read(nonce);must(e)
  return Envelope{h,nonce,gcm.Seal(nil,nonce,r.Data,aad)},nil
 case "decrypt":
  env:=r.Envelope;h:=env.Header
  if h.Version!=1||h.Scheme!="FAME-AES-256-GCM"||h.PublicID!=fingerprint(r.Public)||r.Key.PublicID!=h.PublicID||len(env.Ciphertext)>5*1024*1024+16||len(env.Nonce)!=12 {panic(denied)}
  secret,e:=a.Decrypt(capsuleNative(h.Capsule,h.Policy),keyNative(r.Key),publicNative(r.Public));must(e)
  key,e:=base64.StdEncoding.DecodeString(secret);must(e);if len(key)!=32 {panic(denied)}
  block,e:=aes.NewCipher(key);must(e);gcm,e:=cipher.NewGCM(block);must(e);aad,e:=json.Marshal(h);must(e)
  plain,e:=gcm.Open(nil,env.Nonce,env.Ciphertext,aad);must(e)
  return map[string]any{"data":plain,"filename":h.Filename},nil
 default:return nil,errors.New("Unknown crypto operation")
 }
}
func Handle(input []byte) []byte {
 var r Request
 if len(input)>16*1024*1024||json.Unmarshal(input,&r)!=nil {return []byte(`{"error":"Invalid request"}`)}
 result,err:=Execute(r);if err!=nil {b,_:=json.Marshal(map[string]string{"error":err.Error()});return b}
 b,e:=json.Marshal(map[string]any{"result":result});if e!=nil{return []byte(`{"error":"Encoding failed"}`)};return b
}
