use crate::SDK_ABI_VERSION;
use libloading as libl;
use std::ops::Deref;
use std::os::raw::{c_float, c_int, c_uint, c_ushort};
pub use wooting_analog_common::{
    DeviceEventType, DeviceID, DeviceInfo_FFI, KeycodeType, WootingAnalogResult,
};

macro_rules! dynamic_extern {
    (@as_item $i:item) => {$i};

    (
        #[link=$lib:tt]
        extern $cconv:tt {
            $(
                $(#[$attr:meta])*
                fn $fn_names:ident($($fn_arg_names:ident: $fn_arg_tys:ty),*) $(-> $fn_ret_tys:ty)*;
            )*
        }
    ) => {
        lazy_static! {
            static ref LIB : Option<libl::Library> = {
                #[cfg(target_arch="x86")]
                let lib_path = concat!($lib, "32");

                #[cfg(all(unix, not(target_os = "macos")))]
                let lib_path = concat!("lib", $lib, ".so");
                #[cfg(all(unix, target_os = "macos"))]
                let lib_path = concat!("lib", $lib, ".dylib");
                #[cfg(windows)]
                let lib_path = $lib;

                //Attempt to load the library, if it fails print the error and discard the error
                libl::Library::new(lib_path).map_err(|_e| {
                    #[cfg(feature = "print-errors")]
                    println!("Unable to load library: {}\nErr: {}", lib_path, _e);
                }).ok()
            };
        }
        $(
            dynamic_extern! {
                @as_item
                $(#[$attr])*
                #[no_mangle]
                pub unsafe extern fn $fn_names($($fn_arg_names: $fn_arg_tys),*) $(-> $fn_ret_tys)* {
                    type FnPtr = unsafe extern $cconv fn($($fn_arg_tys),*) $(-> $fn_ret_tys)*;

                    if LIB.is_none() {
                        return WootingAnalogResult::DLLNotFound.into();
                    }

                    if stringify!($fn_names) != "wooting_analog_version" && wooting_analog_version() >= 0 && wooting_analog_version() != SDK_ABI_VERSION as i32 {
                        #[cfg(feature = "print-errors")]
                        println!("Cannot access Wooting Analog SDK function as this wrapper is for SDK major version {}, whereas the SDK has major version {}", SDK_ABI_VERSION, wooting_analog_version());
                        return WootingAnalogResult::IncompatibleVersion.into()
                    }

                    lazy_static! {
                        static ref FUNC: Option<libl::Symbol<'static, FnPtr>> = {
                            LIB.as_ref().and_then(|lib| unsafe {
                                //Get func, print and discard error as we don't need it again
                                lib.get(stringify!($fn_names).as_bytes()).map_err(|_e| {
                                    #[cfg(feature = "print-errors")]
                                    println!("Could not find symbol '{}', {}", stringify!($fn_names), _e);
                                }).ok()
                            })
                        };
                    }
                    match FUNC.deref() {
                        Some(f) => f($($fn_arg_names),*),
                        _ => WootingAnalogResult::FunctionNotFound.into()
                    }
                }
            }
        )*
    };
}

dynamic_extern! {
    #[link="wooting_analog_sdk"]
    extern "C" {
        /// Provides the major version of the SDK, a difference in this value to what is expected indicates that
        /// there may be some breaking changes that have been made so the SDK should not be attempted to be used
        fn wooting_analog_version() -> c_int;

        /// Initialises the Analog SDK, this needs to be successfully called before any other functions
        /// of the SDK can be called
        ///
        /// # Expected Returns
        /// * `ret>=0`: Meaning the SDK initialised successfully and the number indicates the number of devices that were found on plugin initialisation
        /// * `NoPlugins`: Meaning that either no plugins were found or some were found but none were successfully initialised
        /// * `FunctionNotFound`: The SDK is either not installed or could not be found
        /// * `IncompatibleVersion`: The installed SDK is incompatible with this wrapper as they are on different Major versions
        fn wooting_analog_initialise() -> c_int;

        /// Returns a bool indicating if the Analog SDK has been initialised
        fn wooting_analog_is_initialised() -> bool;

        /// Uninitialises the SDK, returning it to an empty state, similar to how it would be before first initialisation
        /// # Expected Returns
        /// * `Ok`: Indicates that the SDK was successfully uninitialised
        fn wooting_analog_uninitialise() -> WootingAnalogResult;

        /// Sets the type of Keycodes the Analog SDK will receive (in `read_analog`) and output (in `read_full_buffer`).
        ///
        /// By default, the mode is set to HID
        ///
        /// # Notes
        /// * `VirtualKey` and `VirtualKeyTranslate` are only available on Windows
        /// * With all modes except `VirtualKeyTranslate`, the key identifier will point to the physical key on the standard layout. i.e. if you ask for the Q key, it will be the key right to tab regardless of the layout you have selected
        /// * With `VirtualKeyTranslate`, if you request Q, it will be the key that inputs Q on the current layout, not the key that is Q on the standard layout.
        ///
        /// # Expected Returns
        /// * `Ok`: The Keycode mode was changed successfully
        /// * `InvalidArgument`: The given `KeycodeType` is not one supported by the SDK
        /// * `NotAvailable`: The given `KeycodeType` is present, but not supported on the current platform
        /// * `UnInitialized`: The SDK is not initialised
        fn wooting_analog_set_keycode_mode(mode: KeycodeType) -> WootingAnalogResult;

        /// Reads the Analog value of the key with identifier `code` from any connected device. The set of key identifiers that is used
        /// depends on the Keycode mode set using `wooting_analog_set_mode`.
        ///
        /// # Examples
        /// ```ignore
        /// wooting_analog_set_mode(KeycodeType::ScanCode1);
        /// wooting_analog_read_analog(0x10); //This will get you the value for the key which is Q in the standard US layout (The key just right to tab)
        ///
        /// wooting_analog_set_mode(KeycodeType::VirtualKey); //This will only work on Windows
        /// wooting_analog_read_analog(0x51); //This will get you the value for the key that is Q on the standard layout
        ///
        /// wooting_analog_set_mode(KeycodeType::VirtualKeyTranslate);
        /// wooting_analog_read_analog(0x51); //This will get you the value for the key that inputs Q on the current layout
        /// ```
        ///
        /// # Expected Returns
        /// The float return value can be either a 0->1 analog value, or (if <0) is part of the WootingAnalogResult enum, which is how errors are given back on this call.
        /// So if the value is below 0, you should cast it as WootingAnalogResult to see what the error is.
        /// * `0.0f - 1.0f`: The Analog value of the key with the given id `code`
        /// * `WootingAnalogResult::NoMapping`: No keycode mapping was found from the selected mode (set by wooting_analog_set_mode) and HID.
        /// * `WootingAnalogResult::UnInitialized`: The SDK is not initialised
        /// * `WootingAnalogResult::NoDevices`: There are no connected devices
        fn wooting_analog_read_analog(code: c_ushort) -> f32;

        /// Reads the Analog value of the key with identifier `code` from the device with id `device_id`. The set of key identifiers that is used
        /// depends on the Keycode mode set using `wooting_analog_set_mode`.
        ///
        /// The `device_id` can be found through calling `wooting_analog_device_info` and getting the DeviceID from one of the DeviceInfo structs
        ///
        /// # Expected Returns
        /// The float return value can be either a 0->1 analog value, or (if <0) is part of the WootingAnalogResult enum, which is how errors are given back on this call.
        /// So if the value is below 0, you should cast it as WootingAnalogResult to see what the error is.
        /// * `0.0f - 1.0f`: The Analog value of the key with the given id `code` from device with id `device_id`
        /// * `WootingAnalogResult::NoMapping`: No keycode mapping was found from the selected mode (set by wooting_analog_set_mode) and HID.
        /// * `WootingAnalogResult::UnInitialized`: The SDK is not initialised
        /// * `WootingAnalogResult::NoDevices`: There are no connected devices with id `device_id`
        fn wooting_analog_read_analog_device(code: c_ushort, device_id: DeviceID) -> f32;

        /// Set the callback which is called when there is a DeviceEvent. Currently these events can either be Disconnected or Connected(Currently not properly implemented).
        /// The callback gets given the type of event `DeviceEventType` and a pointer to the DeviceInfo struct that the event applies to
        ///
        /// # Notes
        /// * You must copy the DeviceInfo struct or its data if you wish to use it after the callback has completed, as the memory will be freed straight after
        /// * The execution of the callback is performed in a separate thread so it is fine to put time consuming code and further SDK calls inside your callback
        ///
        /// # Expected Returns
        /// * `Ok`: The callback was set successfully
        /// * `UnInitialized`: The SDK is not initialised
        fn wooting_analog_set_device_event_cb(cb: extern fn(DeviceEventType, *mut DeviceInfo_FFI)) -> WootingAnalogResult;

        /// Clears the device event callback that has been set
        ///
        /// # Expected Returns
        /// * `Ok`: The callback was cleared successfully
        /// * `UnInitialized`: The SDK is not initialised
        fn wooting_analog_clear_device_event_cb() -> WootingAnalogResult;

        /// Fills up the given `buffer`(that has length `len`) with pointers to the DeviceInfo structs for all connected devices (as many that can fit in the buffer)
        ///
        /// # Notes
        /// * The memory of the returned structs will only be kept until the next call of `get_connected_devices_info`, so if you wish to use any data from them, please copy it or ensure you don't reuse references to old memory after calling `get_connected_devices_info` again.
        ///
        /// # Expected Returns
        /// Similar to wooting_analog_read_analog, the errors and returns are encoded into one type. Values >=0 indicate the number of items filled into the buffer, with `<0` being of type WootingAnalogResult
        /// * `ret>=0`: The number of connected devices that have been filled into the buffer
        /// * `WootingAnalogResult::UnInitialized`: Indicates that the AnalogSDK hasn't been initialised
        fn wooting_analog_get_connected_devices_info(buffer: *mut *mut DeviceInfo_FFI, len: c_uint) -> c_int;

        /// Reads all the analog values for pressed keys for all devices and combines their values, filling up `code_buffer` with the
        /// keycode identifying the pressed key and fills up `analog_buffer` with the corresponding float analog values. i.e. The analog
        /// value for they key at index 0 of code_buffer, is at index 0 of analog_buffer.
        ///
        /// # Notes
        /// * `len` is the length of code_buffer & analog_buffer, if the buffers are of unequal length, then pass the lower of the two, as it is the max amount of
        /// key & analog value pairs that can be filled in.
        /// * The codes that are filled into the `code_buffer` are of the KeycodeType set with wooting_analog_set_mode
        /// * If two devices have the same key pressed, the greater value will be given
        /// * When a key is released it will be returned with an analog value of 0.0f in the first read_full_buffer call after the key has been released
        ///
        /// # Expected Returns
        /// Similar to other functions like `wooting_analog_device_info`, the return value encodes both errors and the return value we want.
        /// Where >=0 is the actual return, and <0 should be cast as WootingAnalogResult to find the error.
        /// * `>=0` means the value indicates how many keys & analog values have been read into the buffers
        /// * `WootingAnalogResult::UnInitialized`: Indicates that the AnalogSDK hasn't been initialised
        /// * `WootingAnalogResult::NoDevices`: Indicates no devices are connected
        fn wooting_analog_read_full_buffer(code_buffer: *mut c_ushort, analog_buffer: *mut c_float, len: c_uint) -> c_int;

        /// Reads all the analog values for pressed keys for the device with id `device_id`, filling up `code_buffer` with the
        /// keycode identifying the pressed key and fills up `analog_buffer` with the corresponding float analog values. i.e. The analog
        /// value for they key at index 0 of code_buffer, is at index 0 of analog_buffer.
        ///
        /// # Notes
        /// * `len` is the length of code_buffer & analog_buffer, if the buffers are of unequal length, then pass the lower of the two, as it is the max amount of
        /// key & analog value pairs that can be filled in.
        /// * The codes that are filled into the `code_buffer` are of the KeycodeType set with wooting_analog_set_mode
        /// * When a key is released it will be returned with an analog value of 0.0f in the first read_full_buffer call after the key has been released
        ///
        /// # Expected Returns
        /// Similar to other functions like `wooting_analog_device_info`, the return value encodes both errors and the return value we want.
        /// Where >=0 is the actual return, and <0 should be cast as WootingAnalogResult to find the error.
        /// * `>=0` means the value indicates how many keys & analog values have been read into the buffers
        /// * `WootingAnalogResult::UnInitialized`: Indicates that the AnalogSDK hasn't been initialised
        /// * `WootingAnalogResult::NoDevices`: Indicates the device with id `device_id` is not connected
        fn wooting_analog_read_full_buffer_device(code_buffer: *mut c_ushort, analog_buffer: *mut c_float, len: c_uint, device_id: DeviceID) -> c_int;
    }
}
