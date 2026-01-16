package model

type Student struct {
	ID    int    `gorm:"autoincrement;unique;not null"`
	Name  string `gorm:"not null;"`
	Age   int    `gorm:"not null"`
	Grade int    `gorm:"not null;check:grade in (1,2,3,4);comment:1：一年级,2：二年级，3：三年级，4：四年级"`
}

type Account struct {
	ID      string  `gorm:"not null;primaryKey;unique"`
	Balance float64 `gorm:"type:decimal(10,2);not null;default:0.00;check:balance >= 0"`
}

type Transcation struct {
	ID              int     `gorm:"not null;primaryKey;nuique"`
	From_Account_ID string  `gorm:"not null;"`
	To_Account_ID   string  `gorm:"not null"`
	Amount          float64 `gorm:"not null;type:decimal(10,2);amount >= 0;"`
}
