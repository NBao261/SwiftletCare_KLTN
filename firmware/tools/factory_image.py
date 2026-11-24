"""Đích `factory` của PlatformIO: gộp bootloader, bảng phân vùng, boot_app0 và firmware thành một ảnh cài đặt.

    pio run -e esp32prod -t factory      # → .pio/build/esp32prod/factory.bin

Ảnh ghi từ địa chỉ 0x0. Tải lên kho firmware (trang Cập nhật firmware hoặc thẻ "Kho firmware" ở màn Kho thiết bị): trạm nạp ghi thẳng vào bo mạch qua USB, đợt cập nhật gửi phần firmware từ xa
(docs/reports/todo-device-flashing-1124.md §6). File chứa giá trị của Secrets.h: không đưa lên chỗ công khai.

Chỉ dựng cho esp32prod: bản dev (MQTT 1883, không TLS) cài qua đợt cập nhật sẽ không nối được broker và quay về bản cũ.
Ghi nguyên file bằng `esptool write_flash 0x0 factory.bin` sẽ xoá vùng NVS (0x9000–0xE000: mã thiết bị, mật khẩu broker,
Wi-Fi, dòng điện đã học); chỉ trạm nạp trên web bỏ qua vùng này.
"""
Import("env")  # noqa: F821 — PlatformIO nạp sẵn

from os.path import join


def build_factory(source, target, env):
    if env["PIOENV"] != "esp32prod":
        # Chữ không dấu: console Windows (cp1252) không in được tiếng Việt
        print("factory.bin is built for esp32prod only: pio run -e esp32prod -t factory")
        env.Exit(1)
    build_dir = env.subst("$BUILD_DIR")
    output = join(build_dir, "factory.bin")
    # Bootloader 0x1000, bảng phân vùng 0x8000, boot_app0 0xE000 (PlatformIO khai trong FLASH_EXTRA_IMAGES), rồi firmware
    images = [(offset, env.subst(path)) for offset, path in env.get("FLASH_EXTRA_IMAGES", [])]
    images.append((env.subst("$ESP32_APP_OFFSET"), join(build_dir, env.subst("${PROGNAME}.bin"))))
    parts = " ".join(f'{offset} "{path}"' for offset, path in images)
    command = (
        f'"$PYTHONEXE" "$OBJCOPY" --chip esp32 merge_bin -o "{output}" '
        f"--flash_mode {env.BoardConfig().get('build.flash_mode', 'dio')} --flash_size 4MB {parts}"
    )
    if env.Execute(command):
        env.Exit(1)
    print(f"Factory image: {output}")


env.AddCustomTarget(  # noqa: F821
    name="factory",
    dependencies="$BUILD_DIR/${PROGNAME}.bin",
    actions=build_factory,
    title="Factory image",
    description="Gộp bootloader, phân vùng, boot_app0 và firmware thành factory.bin (ghi từ 0x0)",
)
