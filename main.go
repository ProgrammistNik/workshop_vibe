package main

import (
	"archive/zip"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func pack() error {
	if _, err := os.Stat("site/index.html"); err != nil {
		return fmt.Errorf("нет site/index.html: %w", err)
	}
	tmp, err := os.CreateTemp(".", "shop-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	zw := zip.NewWriter(tmp)
	err = filepath.WalkDir("site", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("необычный файл или ссылка: %s", path)
		}
		relative, err := filepath.Rel("site", path)
		if err != nil {
			return err
		}
		w, err := zw.Create(filepath.ToSlash(relative))
		if err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
	closeErr := zw.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	if err = os.Rename(tmp.Name(), "shop.zip"); err != nil {
		return err
	}
	fmt.Println("Готово: shop.zip (index.html в корне)")
	return nil
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--pack" {
		if err := pack(); err != nil {
			log.Fatal(err)
		}
		return
	}
	if _, err := os.Stat("site/index.html"); err != nil {
		log.Fatal("Запустите из корня проекта: отсутствует site/index.html")
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	address := net.JoinHostPort(host, port)
	server := &http.Server{Addr: address, Handler: http.FileServer(http.Dir("site")), ReadHeaderTimeout: 5 * time.Second}
	fmt.Printf("Откройте http://localhost:%s — Ctrl+C для остановки\n", port)
	log.Fatal(server.ListenAndServe())
}
