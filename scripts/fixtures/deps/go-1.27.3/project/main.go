package main

import (
	"fmt"

	"golang.org/x/mod/semver"
	"golang.org/x/net/idna"
)

func main() {
	s, _ := idna.ToASCII("example.com")
	fmt.Println(semver.IsValid("v1.0.0"), s)
}
