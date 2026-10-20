package auth

import "golang.org/x/crypto/bcrypt"

// BcryptHasher is the only place where plain passwords meet persisted hashes.
type BcryptHasher struct {
	Cost int
}

func (h BcryptHasher) Hash(plain string) (string, error) {
	cost := h.Cost
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), cost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (h BcryptHasher) Verify(hash, plain string) bool {
	if hash == "" || plain == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}
