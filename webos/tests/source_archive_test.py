"""Publication regression: private keys and linked files must never escape."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'source_archive', Path(__file__).parents[1] / 'scripts/source-archive.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class SourceArchiveTest(unittest.TestCase):
    def test_excludes_credentials_and_links_but_preserves_dependency_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            safe = ['README.md', '.env.example', 'android/gradlew',
                    'vendor/dependency.crate', 'vendor/library-sources.jar']
            private = ['android/signing/key.jks', 'other/private.PEM',
                       '.env', '.env.production', 'local.properties',
                       'key.properties', 'chat.txt', 'webos/dist/source.zip',
                       'node_modules/package/index.js', 'android/app/build/output.txt']
            for name in safe + private:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture')
            (root / 'linked-key.txt').symlink_to(root / 'other/private.PEM')
            (root / 'linked-directory').symlink_to(root / 'android/signing')
            self.assertEqual({p.relative_to(root).as_posix() for p in archive.source_files(root)}, set(safe))


if __name__ == '__main__':
    unittest.main()
