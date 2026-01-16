package config

type Mysql struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	Config   string
}

func (m Mysql) Dsn() string {
	return m.User + ":" + m.Password + "@tcp(" + m.Host + ":" + m.Port + ")/" + m.Database + "?" + m.Config
}
