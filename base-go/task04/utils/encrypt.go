package utils

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
)

func Md5Encrypt(password string) string {

	salte := "123456**(())"
	saltedPassword := password + salte

	hasher := md5.New()

	hasher.Write([]byte(saltedPassword))

	return hex.EncodeToString(hasher.Sum(nil))
}

func verifyPassword(password, hash string) bool {

	calculatedHash := Md5Encrypt(password)

	return strings.EqualFold(calculatedHash, hash)
}
