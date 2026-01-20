# Command log

Commands executed while attempting to access the repository:

```sh
git clone https://github.com/xai-org/x-algorithm /tmp/x-algorithm
```

Output:

```
Cloning into '/tmp/x-algorithm'...
fatal: unable to access 'https://github.com/xai-org/x-algorithm/': CONNECT tunnel failed, response 403
```

```sh
curl -L https://raw.githubusercontent.com/xai-org/x-algorithm/main/README.md
```

Output:

```
curl: (56) CONNECT tunnel failed, response 403
```
