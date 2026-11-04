package engine
import("testing";"github.com/fentec-project/gofe/abe")
func TestEncoding(t *testing.T){p,m,e:=abe.NewFAME().GenerateMasterKeys();if e!=nil{t.Fatal(e)};t.Log(len(p.PartG2[0].Marshal()),len(p.PartGT[0].Marshal()),len(m.PartG1[0].Marshal()));defer func(){if r:=recover();r!=nil{t.Fatalf("encoding diagnostic: %v",r)}}();_,e=abe.NewFAME().Encrypt("test",policyNative("student_23cs101 OR (role_faculty AND dept_cse)"),p);if e!=nil{t.Fatal(e)}}
